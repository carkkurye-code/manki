import { logger } from './logger.js';
import { dbHelpers } from './db.js';
import { DexTrade } from './types.js';

export const ROBINHOOD_RPC_URLS = [
  'https://rpc.mainnet.chain.robinhood.com',
  'https://robinhood-rpc.publicnode.com'
];
export const ROBINHOOD_RPC_URL = ROBINHOOD_RPC_URLS[0];
export const ROBINHOOD_CHAIN_ID = 4663;

// Known contract addresses on Robinhood chain to exclude from being classified as wallet addresses
const KNOWN_CONTRACT_ADDRESSES = new Set<string>([
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
  '0x00000000000000000000000000000000000a4b05', // System / sequencer contract
  '0x000000000022d473030f116ddee9f6b43ac78ba3', // Permit2
]);

export interface RawSwapRecord {
  chain: 'robinhood';
  tokenAddress: string;
  poolAddress: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  walletAddress: string;
  detectedAt: number;
  rawEventTopic: string;
  transactionFrom: string;
  side: 'BUY' | 'SELL' | 'UNKNOWN';
  amount: number;
}

export interface RpcMvpResult {
  rpcOk: boolean;
  chainId: number;
  chainIdMatches: boolean;
  latestBlock: number;
  tokenAddress: string;
  poolAddress: string;
  symbol: string;
  logsFound: number;
  swapTransactionsFound: number;
  uniqueWalletsFound: number;
  txFromExtracted: number;
  buyEvents: number;
  sellEvents: number;
  unknownEvents: number;
  sampleTxHash: string | null;
  savedToDbCount: number;
  error?: string;
}

export class RobinhoodRpcClient {
  private rpcUrls: string[];
  private currentRpcIndex = 0;

  constructor(rpcUrls: string[] = ROBINHOOD_RPC_URLS) {
    this.rpcUrls = [...rpcUrls];
  }

  get rpcUrl(): string {
    return this.rpcUrls[this.currentRpcIndex % this.rpcUrls.length];
  }

  private rotateRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
  }

  /**
   * Robust JSON-RPC caller with automatic retry, exponential backoff, and RPC rotation
   */
  async callRpc<T = any>(method: string, params: any[] = [], retries = 4): Promise<T> {
    let lastError: any = null;
    let delayMs = 400;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const url = this.rpcUrl;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Robinhood-Onchain-Reader/1.0'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Math.floor(Math.random() * 100000),
            method,
            params
          }),
          signal: AbortSignal.timeout(8000)
        });

        if (response.status === 429) {
          this.rotateRpc();
          throw new Error(`HTTP 429: Too Many Requests on ${url}`);
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(`RPC Error [${data.error.code}]: ${data.error.message}`);
        }

        return data.result as T;
      } catch (err: any) {
        lastError = err;
        if (attempt < retries) {
          const is429 = err.message?.includes('429');
          const waitTime = is429 ? Math.max(1200, delayMs * 2) : delayMs;
          await new Promise(r => setTimeout(r, waitTime));
          delayMs *= 2;
        }
      }
    }

    throw lastError || new Error(`RPC call ${method} failed after ${retries} attempts`);
  }

  /**
   * Verify chain ID (0x1237 -> 4663)
   */
  async eth_chainId(): Promise<number> {
    const hex = await this.callRpc<string>('eth_chainId', []);
    return parseInt(hex, 16);
  }

  /**
   * Get latest block number
   */
  async eth_blockNumber(): Promise<number> {
    const hex = await this.callRpc<string>('eth_blockNumber', []);
    return parseInt(hex, 16);
  }

  /**
   * Get block by number
   */
  async eth_getBlockByNumber(blockNum: number | string, includeTxs: boolean = false): Promise<any> {
    const hex = typeof blockNum === 'number' ? '0x' + blockNum.toString(16) : blockNum;
    return this.callRpc('eth_getBlockByNumber', [hex, includeTxs]);
  }

  /**
   * Get transaction details by hash
   */
  async eth_getTransactionByHash(txHash: string): Promise<any> {
    return this.callRpc('eth_getTransactionByHash', [txHash]);
  }

  /**
   * Batch get transaction details by hashes with automatic retry
   */
  async eth_getTransactionsByHashBatch(
    txHashes: string[],
    batchSize = 25,
    maxConcurrency = 2
  ): Promise<Map<string, { tx: any; error?: string }>> {
    const resultMap = new Map<string, { tx: any; error?: string }>();
    if (!txHashes || txHashes.length === 0) return resultMap;

    const batches: string[][] = [];
    for (let i = 0; i < txHashes.length; i += batchSize) {
      batches.push(txHashes.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const currentBatches = batches.slice(i, i + maxConcurrency);
      await Promise.all(
        currentBatches.map(async (batch) => {
          let retries = 4;
          let delayMs = 300;
          let success = false;

          while (retries > 0 && !success) {
            const currentUrl = this.rpcUrl;
            try {
              const body = batch.map((hash, idx) => ({
                jsonrpc: '2.0',
                id: idx + 1,
                method: 'eth_getTransactionByHash',
                params: [hash]
              }));

              const response = await fetch(currentUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'Robinhood-Onchain-Reader/1.0'
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000)
              });

              if (response.status === 429) {
                this.rotateRpc();
                throw new Error(`HTTP 429: Too Many Requests on ${currentUrl}`);
              }

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }

              const data = await response.json();
              if (Array.isArray(data)) {
                batch.forEach((hash, idx) => {
                  const item = data.find((d: any) => d.id === idx + 1) || data[idx];
                  if (item && item.result) {
                    resultMap.set(hash.toLowerCase(), { tx: item.result });
                  } else if (item && item.error) {
                    resultMap.set(hash.toLowerCase(), { tx: null, error: item.error.message });
                  } else {
                    resultMap.set(hash.toLowerCase(), { tx: null, error: 'Transaction not found or null' });
                  }
                });
                success = true;
              } else {
                throw new Error('RPC did not return array for batch request');
              }
            } catch (err: any) {
              retries--;
              if (retries > 0) {
                const is429 = err.message?.includes('429');
                const waitTime = is429 ? Math.max(1500, delayMs * 2) : delayMs;
                await new Promise(r => setTimeout(r, waitTime));
                delayMs *= 2;
              } else {
                batch.forEach((hash) => {
                  if (!resultMap.has(hash.toLowerCase())) {
                    resultMap.set(hash.toLowerCase(), { tx: null, error: err.message });
                  }
                });
              }
            }
          }
        })
      );
      // Small pacing delay to respect RPC rate limits
      await new Promise(r => setTimeout(r, 60));
    }

    return resultMap;
  }

  /**
   * Get transaction receipt by hash
   */
  async eth_getTransactionReceipt(txHash: string): Promise<any> {
    return this.callRpc('eth_getTransactionReceipt', [txHash]);
  }

  /**
   * Get event logs matching filter
   */
  async eth_getLogs(filter: {
    address?: string;
    topics?: (string | null)[];
    fromBlock: string | number;
    toBlock: string | number;
  }): Promise<any[]> {
    const formattedFilter = {
      ...filter,
      fromBlock: typeof filter.fromBlock === 'number' ? '0x' + filter.fromBlock.toString(16) : filter.fromBlock,
      toBlock: typeof filter.toBlock === 'number' ? '0x' + filter.toBlock.toString(16) : filter.toBlock
    };
    return this.callRpc<any[]>('eth_getLogs', [formattedFilter]);
  }

  /**
   * Real Token Discovery on Robinhood Chain using DEX Screener
   */
  async discoverRobinhoodToken(): Promise<{
    tokenAddress: string;
    poolAddress: string;
    symbol: string;
    name: string;
  }> {
    // Verified real token list on Robinhood Chain from MEXC listing & DEX Screener
    const defaultToken = {
      tokenAddress: '0x4Eb990547BCe4a982432CA88Cf5fae7EED1A2d35',
      poolAddress: '0x6f638b29e275cab8f584df0a4c6a045922217aed8747f2459eedb034abb31ac7',
      symbol: 'FLYBRAIN',
      name: 'flybrain'
    };

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${defaultToken.tokenAddress}`);
      if (res.ok) {
        const data = await res.json();
        const robinhoodPair = data?.pairs?.find((p: any) => p.chainId === 'robinhood');
        if (robinhoodPair?.baseToken?.address && robinhoodPair?.pairAddress) {
          return {
            tokenAddress: robinhoodPair.baseToken.address,
            poolAddress: robinhoodPair.pairAddress,
            symbol: robinhoodPair.baseToken.symbol || defaultToken.symbol,
            name: robinhoodPair.baseToken.name || defaultToken.name
          };
        }
      }
    } catch {
      // Fall back to verified addresses
    }

    return defaultToken;
  }

  /**
   * Fetch real swaps from Robinhood Chain RPC, extract real wallets, and store into dex_trades
   */
  async processRealRobinhoodSwaps(options: {
    tokenAddress?: string;
    poolAddress?: string;
    blockRange?: number;
    saveToDatabase?: boolean;
  } = {}): Promise<RpcMvpResult> {
    const start = Date.now();
    logger.system('Robinhood RPC MVP: Starting real on-chain swap and wallet extraction...');

    // 1. Verify Chain ID
    const chainId = await this.eth_chainId();
    const chainIdMatches = chainId === ROBINHOOD_CHAIN_ID;
    if (!chainIdMatches) {
      throw new Error(`Chain ID mismatch! Expected ${ROBINHOOD_CHAIN_ID}, received ${chainId}`);
    }

    // 2. Discover Real Token and Pool
    let tokenAddress = options.tokenAddress;
    let poolAddress = options.poolAddress;
    let symbol = 'FLYBRAIN';

    if (!tokenAddress || !poolAddress) {
      const discovered = await this.discoverRobinhoodToken();
      tokenAddress = discovered.tokenAddress;
      poolAddress = discovered.poolAddress;
      symbol = discovered.symbol;
    }

    // 3. Get Current Block
    const currentBlock = await this.eth_blockNumber();
    const blockRange = Math.min(options.blockRange || 200, 1000);
    const fromBlock = Math.max(0, currentBlock - blockRange);

    logger.system(`Robinhood RPC: Querying logs for token ${tokenAddress} from block ${fromBlock} to ${currentBlock} (${blockRange} blocks)...`);

    // 4. Query ERC-20 Transfer and Swap logs
    // Transfer topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const logs = await this.eth_getLogs({
      address: tokenAddress,
      topics: [transferTopic],
      fromBlock,
      toBlock: currentBlock
    });

    const logsFound = logs.length;
    logger.system(`Robinhood RPC: Found ${logsFound} real on-chain event logs.`);

    // 5. Group by Unique Transactions (limited to process safely within rate limits)
    const uniqueTxHashes = Array.from(new Set(logs.map((l: any) => l.transactionHash as string)));
    const txLimit = Math.min(uniqueTxHashes.length, 6);
    const selectedTxHashes = uniqueTxHashes.slice(0, txLimit);

    const rawRecords: RawSwapRecord[] = [];
    const uniqueWallets = new Set<string>();
    let buyCount = 0;
    let sellCount = 0;
    let unknownCount = 0;
    let txFromExtracted = 0;

    // Cache block timestamps to avoid redundant block requests
    const blockTimestampCache = new Map<number, number>();

    // 6. Inspect Transactions and Receipts in controlled concurrent batches
    const chunkSize = 3;
    for (let i = 0; i < selectedTxHashes.length; i += chunkSize) {
      const batch = selectedTxHashes.slice(i, i + chunkSize);
      const txResults = await Promise.all(
        batch.map(async (txHash) => {
          try {
            const tx = await this.eth_getTransactionByHash(txHash);
            return { txHash, tx };
          } catch {
            return { txHash, tx: null };
          }
        })
      );

      for (const { txHash, tx } of txResults) {
        if (!tx || !tx.from) continue;

        txFromExtracted++;
        const signerWallet = tx.from.toLowerCase();

        // Ensure signer is not a known system contract or the token itself
        const tokenAddrLower = tokenAddress.toLowerCase();
        const poolAddrLower = (poolAddress || '').toLowerCase();

        if (
          KNOWN_CONTRACT_ADDRESSES.has(signerWallet) ||
          signerWallet === tokenAddrLower ||
          signerWallet === poolAddrLower
        ) {
          continue;
        }

        // Get block timestamp
        const blockNum = parseInt(tx.blockNumber, 16);
        let timestamp = blockTimestampCache.get(blockNum);
        if (!timestamp) {
          try {
            const block = await this.eth_getBlockByNumber(tx.blockNumber, false);
            timestamp = block?.timestamp ? parseInt(block.timestamp, 16) * 1000 : Date.now();
          } catch {
            timestamp = Date.now();
          }
          blockTimestampCache.set(blockNum, timestamp);
        }

        // Find relevant transfer logs for this transaction
        const txLogs = logs.filter((l: any) => l.transactionHash.toLowerCase() === txHash.toLowerCase());
        const primaryLog = txLogs[0];
        const topic0 = primaryLog?.topics?.[0] || transferTopic;

        // Classify Side: BUY, SELL, or UNKNOWN
        let side: 'BUY' | 'SELL' | 'UNKNOWN' = 'UNKNOWN';
        let amount = 0;

        for (const log of txLogs) {
          if (log.topics && log.topics.length >= 3) {
            const transferFrom = ('0x' + log.topics[1].slice(26)).toLowerCase();
            const transferTo = ('0x' + log.topics[2].slice(26)).toLowerCase();

            try {
              if (log.data && log.data !== '0x') {
                amount = Number(BigInt(log.data)) / 1e18;
              }
            } catch {
              amount = 0;
            }

            // If tokens were transferred TO the signer wallet -> BUY
            if (transferTo === signerWallet) {
              side = 'BUY';
              break;
            }
            // If tokens were transferred FROM the signer wallet -> SELL
            else if (transferFrom === signerWallet) {
              side = 'SELL';
              break;
            }
          }
        }

        if (side === 'BUY') buyCount++;
        else if (side === 'SELL') sellCount++;
        else unknownCount++;

        uniqueWallets.add(signerWallet);

        rawRecords.push({
          chain: 'robinhood',
          tokenAddress,
          poolAddress: poolAddress || '',
          transactionHash: txHash,
          blockNumber: blockNum,
          timestamp,
          walletAddress: signerWallet,
          detectedAt: Date.now(),
          rawEventTopic: topic0,
          transactionFrom: tx.from,
          side,
          amount
        });
      }
    }

    // 7. Save real transactions to dex_trades database (Strictly real data with duplicate prevention)
    let savedToDbCount = 0;
    if (options.saveToDatabase && rawRecords.length > 0) {
      for (const record of rawRecords) {
        const trade: DexTrade = {
          tx_hash: record.transactionHash,
          chain: 'robinhood',
          dex: 'uniswap_v4',
          token_address: record.tokenAddress,
          wallet_address: record.walletAddress,
          timestamp: record.timestamp,
          side: record.side,
          amount: record.amount,
          input_token: record.side === 'BUY' ? 'ETH' : symbol,
          output_token: record.side === 'BUY' ? symbol : 'ETH'
        };

        const inserted = dbHelpers.insertTrade(trade);
        if (inserted) savedToDbCount++;
      }
    }

    logger.system(`Robinhood RPC MVP Complete in ${Date.now() - start}ms: ${rawRecords.length} real swaps parsed, ${uniqueWallets.size} unique wallets extracted, ${savedToDbCount} saved to database.`);

    return {
      rpcOk: true,
      chainId,
      chainIdMatches,
      latestBlock: currentBlock,
      tokenAddress,
      poolAddress: poolAddress || '',
      symbol,
      logsFound,
      swapTransactionsFound: rawRecords.length,
      uniqueWalletsFound: uniqueWallets.size,
      txFromExtracted,
      buyEvents: buyCount,
      sellEvents: sellCount,
      unknownEvents: unknownCount,
      sampleTxHash: rawRecords.length > 0 ? rawRecords[0].transactionHash : null,
      savedToDbCount
    };
  }
}

export const robinhoodRpc = new RobinhoodRpcClient();
