import crypto from 'crypto';
import { logger } from './logger.js';
import { dbHelpers } from './db.js';
import { MexcListing } from './types.js';

interface MexcSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  fullName?: string;
  contractAddress?: string;
  conceptPlates?: string[];
  firstOpenTime?: number;
}

// Helper to determine chain from address or DexScreener
export async function resolveTokenChainAndMetadata(contractAddress: string, symbolHint?: string): Promise<{ chain: string; name?: string; dexPool?: string }> {
  // Check if it's obvious Solana pump.fun or base58 token
  const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(contractAddress);
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(contractAddress);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MEXC-Smart-Wallet-Tracker/1.0' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.pairs && data.pairs.length > 0) {
        // Sort pairs by volume/liquidity to get primary pool
        const topPair = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        return {
          chain: topPair.chainId?.toLowerCase() || (isSolana ? 'solana' : (isEvm ? 'ethereum' : 'unknown')),
          name: topPair.baseToken?.name,
          dexPool: topPair.pairAddress
        };
      }
    }
  } catch (err: any) {
    // Network or rate limit fallback
  }

  if (isSolana) return { chain: 'solana' };
  if (isEvm) return { chain: 'ethereum' };
  return { chain: 'unknown' };
}

export class MexcListingCollector {
  private isCollecting = false;

  public hasCredentials(): boolean {
    const key = process.env.MEXC_API_KEY;
    const secret = process.env.MEXC_API_SECRET;
    return Boolean(key && key.trim() && secret && secret.trim());
  }

  // Safe read-only diagnostic verification of MEXC API credentials and permissions
  public async verifyAuth(): Promise<{
    configured: boolean;
    authenticated: boolean;
    readOnly: boolean;
    listingApi: boolean;
    error?: string;
  }> {
    if (!this.hasCredentials()) {
      return {
        configured: false,
        authenticated: false,
        readOnly: true,
        listingApi: false,
        error: 'MEXC credentials are not configured in environment variables.'
      };
    }

    const apiKey = process.env.MEXC_API_KEY!.trim();
    const apiSecret = process.env.MEXC_API_SECRET!.trim();

    try {
      // 1. Verify signed read-only endpoint authentication
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}&recvWindow=5000`;
      const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

      const authRes = await fetch(`https://api.mexc.com/api/v3/selfSymbols?${queryString}&signature=${signature}`, {
        headers: {
          'X-MEXC-APIKEY': apiKey,
          'User-Agent': 'MEXC-Smart-Wallet-Tracker/1.0'
        }
      });

      if (!authRes.ok) {
        const errJson = await authRes.json().catch(() => ({}));
        const errMsg = errJson.msg || `HTTP ${authRes.status}`;
        return {
          configured: true,
          authenticated: false,
          readOnly: true,
          listingApi: false,
          error: `Authentication failed (${errMsg})`
        };
      }

      // 2. Verify that trading is blocked / strictly read-only
      // Calling a trading endpoint (openOrders) must return permission denied (code 700007)
      const tradeCheckQs = `symbol=BTCUSDT&timestamp=${timestamp}&recvWindow=5000`;
      const tradeSig = crypto.createHmac('sha256', apiSecret).update(tradeCheckQs).digest('hex');
      const tradeRes = await fetch(`https://api.mexc.com/api/v3/openOrders?${tradeCheckQs}&signature=${tradeSig}`, {
        headers: {
          'X-MEXC-APIKEY': apiKey,
          'User-Agent': 'MEXC-Smart-Wallet-Tracker/1.0'
        }
      });

      const tradeData = await tradeRes.json().catch(() => ({}));
      // If code is 700007 or status 400/403, trade permission is safely absent
      const isReadOnly = tradeRes.status !== 200 || tradeData.code === 700007;

      // 3. Verify public listing endpoint
      const listingRes = await fetch('https://api.mexc.com/api/v3/exchangeInfo', {
        headers: {
          'User-Agent': 'MEXC-Smart-Wallet-Tracker/1.0',
          'X-MEXC-APIKEY': apiKey
        }
      });

      const listingOk = listingRes.ok;

      return {
        configured: true,
        authenticated: true,
        readOnly: isReadOnly,
        listingApi: listingOk
      };
    } catch (err: any) {
      return {
        configured: true,
        authenticated: false,
        readOnly: true,
        listingApi: false,
        error: err.message || 'Network error during MEXC verification'
      };
    }
  }

  async collectHistoricalListings(limit = 25, memeOnly = true): Promise<MexcListing[]> {
    if (this.isCollecting) {
      logger.mexc('Collector is already running, skipping overlapping request.');
      return [];
    }

    this.isCollecting = true;
    logger.mexc(`Starting MEXC listing collection (limit: ${limit}, memeOnly: ${memeOnly})...`);

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'MEXC-Smart-Wallet-Tracker/1.0'
      };
      if (process.env.MEXC_API_KEY && process.env.MEXC_API_KEY.trim()) {
        headers['X-MEXC-APIKEY'] = process.env.MEXC_API_KEY.trim();
      }

      const response = await fetch('https://api.mexc.com/api/v3/exchangeInfo', {
        headers
      });

      if (!response.ok) {
        throw new Error(`MEXC API returned status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const allSymbols: MexcSymbolInfo[] = data.symbols || [];
      logger.mexc(`Fetched ${allSymbols.length} total trading pairs from MEXC exchangeInfo.`);

      // Filter symbols with contractAddress and firstOpenTime
      let eligible = allSymbols.filter(s => s.contractAddress && s.firstOpenTime && s.contractAddress.trim() !== '');

      if (memeOnly) {
        const memeSymbols = eligible.filter(s => s.conceptPlates?.some(p => p.toLowerCase().includes('meme')));
        logger.mexc(`Found ${memeSymbols.length} pairs explicitly tagged with 'MEME' plate.`);
        eligible = memeSymbols.length > 0 ? memeSymbols : eligible;
      }

      // Sort by firstOpenTime descending (most recent listings first)
      eligible.sort((a, b) => (b.firstOpenTime || 0) - (a.firstOpenTime || 0));

      const selected = eligible.slice(0, limit);
      logger.mexc(`Processing ${selected.length} listings with contract resolution...`);

      const savedListings: MexcListing[] = [];

      for (let i = 0; i < selected.length; i++) {
        const item = selected[i];
        const contract = item.contractAddress!.trim();

        // Check if already in DB
        const existing = dbHelpers.getAllListings().find(l => l.token_address.toLowerCase() === contract.toLowerCase());
        if (existing) {
          savedListings.push(existing);
          continue;
        }

        // Determine chain
        const resolved = await resolveTokenChainAndMetadata(contract, item.baseAsset);
        const isMemeTag: 'yes' | 'no' | 'unknown' = item.conceptPlates?.some(p => p.toLowerCase().includes('meme'))
          ? 'yes'
          : 'unknown';

        const listing: MexcListing = {
          token_address: contract,
          symbol: item.baseAsset,
          name: item.fullName || resolved.name || item.baseAsset,
          chain: resolved.chain,
          listing_timestamp: item.firstOpenTime!,
          listing_url: `https://www.mexc.com/exchange/${item.symbol}`,
          is_meme: isMemeTag,
          created_at: Date.now()
        };

        const success = dbHelpers.insertListing(listing);
        if (success) {
          savedListings.push(listing);
          logger.mexc(
            `[${i + 1}/${selected.length}] Saved listing ${listing.symbol} (${listing.chain}) - Listing time: ${new Date(listing.listing_timestamp).toISOString()}`
          );
        }

        // Polite rate limit sleep
        await new Promise(r => setTimeout(r, 200));
      }

      logger.mexc(`Successfully collected and normalized ${savedListings.length} MEXC listings.`, 'success');
      return savedListings;
    } catch (err: any) {
      logger.mexc(`Collection failed: ${err.message}`, 'error');
      throw err;
    } finally {
      this.isCollecting = false;
    }
  }
}

export const mexcCollector = new MexcListingCollector();
