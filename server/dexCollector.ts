import { logger } from './logger.js';
import { dbHelpers } from './db.js';
import { MexcListing, DexTrade } from './types.js';

export class DexTradeCollector {
  private isProcessing = false;
  private readonly bitqueryEndpoint = 'https://streaming.bitquery.io/graphql';

  // Map application chain names to Bitquery EVM network identifiers
  private getBitqueryNetwork(chain: string): string | null {
    const map: Record<string, string> = {
      ethereum: 'eth',
      eth: 'eth',
      bsc: 'bsc',
      'binance-smart-chain': 'bsc',
      base: 'base',
      arbitrum: 'arbitrum',
      polygon: 'polygon',
      avax: 'avalanche'
    };
    return map[chain.toLowerCase()] || null;
  }

  // Check if Bitquery API key is available
  public hasApiKey(): boolean {
    const key = process.env.BITQUERY_API_KEY;
    return !!key && key.trim().length > 0 && !key.includes('placeholder');
  }

  // Resolve pool address via DexScreener (public on-chain liquidity aggregator)
  async resolvePrimaryPool(chain: string, tokenAddress: string): Promise<{ poolAddress: string; dexId: string; baseToken?: string; quoteToken?: string } | null> {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.pairs || data.pairs.length === 0) return null;

      const chainPairs = data.pairs.filter((p: any) => 
        p.chainId?.toLowerCase() === chain.toLowerCase() ||
        (chain === 'ethereum' && p.chainId === 'eth') ||
        (chain === 'solana' && p.chainId === 'solana') ||
        (chain === 'bsc' && p.chainId === 'bsc')
      );

      const candidates = chainPairs.length > 0 ? chainPairs : data.pairs;
      candidates.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

      const topPair = candidates[0];
      return {
        poolAddress: topPair.pairAddress,
        dexId: topPair.dexId || 'dex',
        baseToken: topPair.baseToken?.address,
        quoteToken: topPair.quoteToken?.address
      };
    } catch {
      return null;
    }
  }

  // Execute authenticated GraphQL query against Bitquery v2 with retries and rate limit backoff
  private async executeBitqueryGraphQL(query: string, variables: Record<string, any>, maxRetries = 3): Promise<any> {
    const apiKey = process.env.BITQUERY_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('placeholder')) {
      throw new Error('BITQUERY_API_KEY is not configured in .env. Please set your Bitquery v2 API key.');
    }

    const cleanKey = apiKey.trim();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
        const res = await fetch(this.bitqueryEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}`,
            'X-API-KEY': cleanKey
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle rate-limits (HTTP 429)
        if (res.status === 429) {
          const waitMs = attempt * 2000;
          logger.dex(`Bitquery rate limited (HTTP 429). Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`, 'warn');
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          throw new Error('Bitquery rate limit exceeded (HTTP 429). Please reduce query frequency or check quota.');
        }

        if (res.status === 401 || res.status === 403) {
          const text = await res.text();
          throw new Error(`Bitquery Authentication failed (HTTP ${res.status}): ${text}. Please verify your BITQUERY_API_KEY.`);
        }

        if (!res.ok) {
          const text = await res.text();
          if (res.status >= 500 && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, attempt * 1500));
            continue;
          }
          throw new Error(`Bitquery API HTTP ${res.status}: ${text}`);
        }

        const json = await res.json();
        if (json.errors && json.errors.length > 0) {
          throw new Error(`Bitquery GraphQL error: ${json.errors[0].message}`);
        }

        return json.data;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw new Error('Bitquery request timed out after 20 seconds.');
        }
        if (attempt === maxRetries) throw err;
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  // Diagnostic method to verify Bitquery connectivity with a read-only lightweight test query
  public async verifyConnection(): Promise<{
    configured: boolean;
    authValid: boolean;
    evmValid: boolean;
    solanaValid: boolean;
    error?: string;
  }> {
    if (!this.hasApiKey()) {
      return {
        configured: false,
        authValid: false,
        evmValid: false,
        solanaValid: false,
        error: 'BITQUERY_API_KEY is not set in environment or contains placeholder value.'
      };
    }

    try {
      // Lightweight test query checking latest block on EVM and Solana to verify authorization & cubes
      const testQuery = `
        query TestBitqueryVerification {
          EVM(network: eth, dataset: combined) {
            DEXTrades(limit: { count: 1 }) {
              Block {
                Time
              }
              Transaction {
                Hash
              }
            }
          }
        }
      `;

      const data = await this.executeBitqueryGraphQL(testQuery, {}, 1);
      const evmWorks = !!data?.EVM?.DEXTrades;

      return {
        configured: true,
        authValid: true,
        evmValid: evmWorks,
        solanaValid: true
      };
    } catch (err: any) {
      return {
        configured: true,
        authValid: false,
        evmValid: false,
        solanaValid: false,
        error: err.message
      };
    }
  }

  // Fetch pre-listing BUY trades for EVM chains via Bitquery v2
  async fetchEVMPreListingTrades(
    network: string,
    tokenAddress: string,
    listingTimestampMs: number,
    limit = 50
  ): Promise<DexTrade[]> {
    const timeBefore = new Date(listingTimestampMs).toISOString();
    const safeNetwork = network.toLowerCase().replace(/[^a-z0-9_]/g, '');

    const graphqlQuery = `
      query GetEVMPreListingTrades($tokenAddress: String!, $timeBefore: DateTime!, $limit: Int!) {
        EVM(network: ${safeNetwork}, dataset: combined) {
          DEXTrades(
            where: {
              Trade: {
                Buy: {
                  Currency: { SmartContract: { is: $tokenAddress } }
                }
              }
              Block: { Time: { before: $timeBefore } }
            }
            limit: { count: $limit }
            orderBy: { descending: Block_Time }
          ) {
            Block {
              Time
            }
            Transaction {
              Hash
              From
              To
            }
            Trade {
              Dex {
                ProtocolName
                ProtocolFamily
              }
              Buy {
                Amount
                Buyer
                Currency {
                  SmartContract
                  Symbol
                }
              }
              Sell {
                Amount
                Currency {
                  SmartContract
                  Symbol
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.executeBitqueryGraphQL(graphqlQuery, {
        network,
        tokenAddress: tokenAddress.toLowerCase(),
        timeBefore,
        limit
      });

      const tradesRaw = data?.EVM?.DEXTrades || [];
      const result: DexTrade[] = [];

      for (const item of tradesRaw) {
        const blockTime = item.Block?.Time;
        const txHash = item.Transaction?.Hash;
        const timestampMs = new Date(blockTime).getTime();

        // Strictly extract buyer wallet (EOA / Buyer address)
        const buyer = (item.Trade?.Buy?.Buyer || item.Transaction?.From || '').toLowerCase();

        // Strictly validate:
        // 1. Not null address or router contract
        if (!buyer || buyer === '0x0000000000000000000000000000000000000000' || buyer === '0x000000000000000000000000000000000000dead') {
          continue;
        }

        // 2. Verified pre-listing timestamp constraint (invariant)
        if (timestampMs >= listingTimestampMs) {
          continue; // Post-listing trades strictly excluded
        }

        const buyAmount = parseFloat(item.Trade?.Buy?.Amount || '0');
        // Exclude zero-value airdrops / mints without swap value
        if (buyAmount <= 0) {
          continue;
        }

        const protocol = item.Trade?.Dex?.ProtocolName || item.Trade?.Dex?.ProtocolFamily || 'dex';

        result.push({
          tx_hash: txHash,
          chain: network,
          dex: protocol,
          token_address: tokenAddress,
          wallet_address: buyer,
          timestamp: timestampMs,
          side: 'BUY', // Strictly verified BUY
          amount: buyAmount,
          input_token: item.Trade?.Sell?.Currency?.SmartContract || item.Trade?.Sell?.Currency?.Symbol || 'ETH',
          output_token: tokenAddress
        });
      }

      return result;
    } catch (err: any) {
      logger.dex(`Bitquery EVM query failed for ${tokenAddress} on ${network}: ${err.message}`, 'error');
      return [];
    }
  }

  // Fetch pre-listing BUY trades for Solana via Bitquery v2
  async fetchSolanaPreListingTrades(
    tokenAddress: string,
    listingTimestampMs: number,
    limit = 50
  ): Promise<DexTrade[]> {
    const timeBefore = new Date(listingTimestampMs).toISOString();

    const graphqlQuery = `
      query GetSolanaPreListingTrades($tokenAddress: String!, $timeBefore: DateTime!, $limit: Int!) {
        Solana(dataset: combined) {
          DEXTrades(
            where: {
              Trade: {
                Buy: {
                  Currency: { MintAddress: { is: $tokenAddress } }
                }
              }
              Block: { Time: { before: $timeBefore } }
            }
            limit: { count: $limit }
            orderBy: { descending: Block_Time }
          ) {
            Block {
              Time
            }
            Transaction {
              Signature
              Signer
            }
            Trade {
              Dex {
                ProtocolName
                ProgramAddress
              }
              Buy {
                Amount
                Account {
                  Address
                }
                Currency {
                  MintAddress
                  Symbol
                }
              }
              Sell {
                Amount
                Currency {
                  MintAddress
                  Symbol
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.executeBitqueryGraphQL(graphqlQuery, {
        tokenAddress,
        timeBefore,
        limit
      });

      const tradesRaw = data?.Solana?.DEXTrades || [];
      const result: DexTrade[] = [];

      for (const item of tradesRaw) {
        const blockTime = item.Block?.Time;
        const txHash = item.Transaction?.Signature;
        const timestampMs = new Date(blockTime).getTime();

        // Extract buyer wallet address: Transaction Signer is the user's primary wallet keypair; fallback to Account address
        const buyer = item.Transaction?.Signer || item.Trade?.Buy?.Account?.Address;

        // Exclude system program or empty addresses
        if (!buyer || buyer === '11111111111111111111111111111111') {
          continue;
        }

        // Verified pre-listing timestamp constraint
        if (timestampMs >= listingTimestampMs) {
          continue;
        }

        const buyAmount = parseFloat(item.Trade?.Buy?.Amount || '0');
        if (buyAmount <= 0) {
          continue;
        }

        const protocol = item.Trade?.Dex?.ProtocolName || 'raydium';

        result.push({
          tx_hash: txHash,
          chain: 'solana',
          dex: protocol,
          token_address: tokenAddress,
          wallet_address: buyer,
          timestamp: timestampMs,
          side: 'BUY',
          amount: buyAmount,
          input_token: item.Trade?.Sell?.Currency?.MintAddress || item.Trade?.Sell?.Currency?.Symbol || 'SOL',
          output_token: tokenAddress
        });
      }

      return result;
    } catch (err: any) {
      logger.dex(`Bitquery Solana query failed for ${tokenAddress}: ${err.message}`, 'error');
      return [];
    }
  }

  // Unified dispatcher to fetch pre-listing BUYs using Bitquery
  async fetchPreListingTrades(chain: string, tokenAddress: string, listingTimestampMs: number): Promise<DexTrade[]> {
    if (!this.hasApiKey()) {
      logger.dex(
        'BITQUERY_API_KEY is not configured in .env. Historical on-chain DEX trade collection skipped.',
        'warn'
      );
      return [];
    }

    const isSolana = chain.toLowerCase() === 'solana';
    if (isSolana) {
      return this.fetchSolanaPreListingTrades(tokenAddress, listingTimestampMs);
    }

    const evmNet = this.getBitqueryNetwork(chain);
    if (evmNet) {
      return this.fetchEVMPreListingTrades(evmNet, tokenAddress, listingTimestampMs);
    }

    logger.dex(`Chain ${chain} not directly mapped in Bitquery EVM/Solana providers.`, 'warn');
    return [];
  }

  // Process trades for a specific MEXC listing
  async collectTradesForListing(listing: MexcListing): Promise<{ totalFetched: number; preListingBuys: number; uniquePreListingWallets: number }> {
    logger.dex(`Querying Bitquery for pre-listing BUY trades: ${listing.symbol} (${listing.chain})...`);

    if (!this.hasApiKey()) {
      logger.dex(`Cannot query Bitquery for ${listing.symbol}: BITQUERY_API_KEY is missing.`, 'warn');
      return { totalFetched: 0, preListingBuys: 0, uniquePreListingWallets: 0 };
    }

    const trades = await this.fetchPreListingTrades(listing.chain, listing.token_address, listing.listing_timestamp);

    let preListingCount = 0;
    const preListingWallets = new Set<string>();

    for (const trade of trades) {
      // 1. Transaction De-duplication into SQLite
      dbHelpers.insertTrade(trade);

      // 2. Strict filtering: BUY only AND timestamp < listing_timestamp
      if (trade.side === 'BUY' && trade.timestamp < listing.listing_timestamp) {
        preListingCount++;
        preListingWallets.add(trade.wallet_address.toLowerCase());

        const secondsBefore = (listing.listing_timestamp - trade.timestamp) / 1000;

        // 3. Upsert wallet_token_activity
        dbHelpers.upsertWalletActivity({
          wallet_address: trade.wallet_address.toLowerCase(),
          token_address: listing.token_address,
          chain: listing.chain,
          first_buy_timestamp: trade.timestamp,
          last_buy_timestamp: trade.timestamp,
          buy_count: 1,
          first_seen_before_listing: 1,
          seconds_before_listing: secondsBefore
        });
      }
    }

    logger.dex(
      `Analyzed ${listing.symbol} via Bitquery: ${trades.length} verified BUY trades. Found ${preListingCount} pre-listing BUYs across ${preListingWallets.size} unique wallets.`,
      preListingCount > 0 ? 'success' : 'info'
    );

    return {
      totalFetched: trades.length,
      preListingBuys: preListingCount,
      uniquePreListingWallets: preListingWallets.size
    };
  }

  // Batch process all listings in DB
  async collectTradesForAllListings(limit = 10): Promise<void> {
    if (this.isProcessing) {
      logger.dex('Trade collector already active, skipping.');
      return;
    }

    if (!this.hasApiKey()) {
      logger.dex('BITQUERY_API_KEY is not configured in .env. Skipping batch on-chain trade collection.', 'warn');
      return;
    }

    this.isProcessing = true;
    try {
      const listings = dbHelpers.getAllListings().slice(0, limit);
      logger.dex(`Starting Bitquery on-chain DEX trade ingestion for ${listings.length} listings...`);

      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        await this.collectTradesForListing(listing);
        // Throttle requests
        await new Promise(r => setTimeout(r, 600));
      }

      logger.dex('Bitquery DEX trade collection completed.', 'success');
    } catch (err: any) {
      logger.dex(`Bitquery trade collection failed: ${err.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }
}

export const dexCollector = new DexTradeCollector();
