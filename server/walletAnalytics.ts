import { db, dbHelpers } from './db.js';
import { logger } from './logger.js';
import { WalletStats, MexcListing, WalletTokenActivity } from './types.js';

export class WalletAnalyticsEngine {
  // Recalculate statistics for all wallets in the database
  recalculateAllWalletStats(): { totalWalletsProcessed: number; smartWalletsFound: number } {
    logger.analysis('Recalculating statistical performance for all detected wallets...');

    // Get all distinct wallets that have wallet_token_activity
    const walletsStmt = db.prepare('SELECT DISTINCT wallet_address FROM wallet_token_activity');
    const walletRows = walletsStmt.all() as { wallet_address: string }[];

    // Get all MEXC listings as a lookup map by chain:token_address (lowercase)
    const allListings = dbHelpers.getAllListings();
    const listingMap = new Map<string, MexcListing>();
    for (const l of allListings) {
      listingMap.set(`${l.chain.toLowerCase()}:${l.token_address.toLowerCase()}`, l);
    }

    let smartWalletsCount = 0;

    for (const row of walletRows) {
      const walletAddr = row.wallet_address.toLowerCase();

      // Retrieve all activities for this wallet
      const activities = dbHelpers.getWalletActivities(walletAddr);
      if (activities.length === 0) continue;

      let totalPreListingBuys = 0;
      let mexcHits = 0;
      let nonMexcBuys = 0;
      const leadTimesSeconds: number[] = [];
      const chainsSet = new Set<string>();
      let firstSeen = Infinity;
      let lastSeen = 0;

      for (const act of activities) {
        chainsSet.add(act.chain);
        if (act.first_buy_timestamp < firstSeen) firstSeen = act.first_buy_timestamp;
        if (act.last_buy_timestamp > lastSeen) lastSeen = act.last_buy_timestamp;

        const key = `${act.chain.toLowerCase()}:${act.token_address.toLowerCase()}`;
        const mexcListing = listingMap.get(key);

        if (mexcListing) {
          // Verify if buy occurred BEFORE listing
          if (act.first_buy_timestamp < mexcListing.listing_timestamp) {
            totalPreListingBuys += 1;
            mexcHits += 1;
            const leadSec = (mexcListing.listing_timestamp - act.first_buy_timestamp) / 1000;
            leadTimesSeconds.push(leadSec);
          } else {
            // Bought AFTER listing, so not a pre-listing buy
            nonMexcBuys += 1;
          }
        } else {
          // Token is not listed on MEXC
          nonMexcBuys += 1;
          totalPreListingBuys += 1; // It was a pre-purchase of a token that did NOT hit MEXC
        }
      }

      // Safe calculation of Hit Rate (Zero division prevention)
      const historicalHitRate = totalPreListingBuys > 0 
        ? Number(((mexcHits / totalPreListingBuys) * 100).toFixed(2)) 
        : 0;

      // Average lead time
      const avgLeadTime = leadTimesSeconds.length > 0
        ? Math.round(leadTimesSeconds.reduce((a, b) => a + b, 0) / leadTimesSeconds.length)
        : 0;

      // Median lead time
      let medianLeadTime = 0;
      if (leadTimesSeconds.length > 0) {
        const sorted = [...leadTimesSeconds].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianLeadTime = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      }

      const stats: WalletStats = {
        wallet_address: walletAddr,
        total_pre_listing_buys: totalPreListingBuys,
        mexc_hits: mexcHits,
        non_mexc_buys: nonMexcBuys,
        historical_hit_rate: historicalHitRate,
        avg_lead_time: avgLeadTime,
        median_lead_time: medianLeadTime,
        chains: Array.from(chainsSet).join(', '),
        first_seen: firstSeen === Infinity ? Date.now() : firstSeen,
        last_seen: lastSeen || Date.now(),
        updated_at: Date.now()
      };

      dbHelpers.upsertWalletStats(stats);

      // Define smart wallet candidate (e.g. at least 2 hits or high hit rate)
      if (mexcHits >= 2 && historicalHitRate >= 50) {
        smartWalletsCount++;
      }
    }

    logger.analysis(
      `Analyzed ${walletRows.length} wallets. Identified ${smartWalletsCount} strong smart wallet candidates (Hits >= 2, Hit Rate >= 50%).`,
      'success'
    );

    return {
      totalWalletsProcessed: walletRows.length,
      smartWalletsFound: smartWalletsCount
    };
  }

  // Get in-depth token history for a specific wallet
  getWalletDetailedHistory(walletAddress: string) {
    const stats = dbHelpers.getWalletStats(walletAddress);
    if (!stats) return null;

    const activities = dbHelpers.getWalletActivities(walletAddress);
    const allListings = dbHelpers.getAllListings();
    const listingMap = new Map<string, MexcListing>();
    for (const l of allListings) {
      listingMap.set(`${l.chain.toLowerCase()}:${l.token_address.toLowerCase()}`, l);
    }

    const tokenHistory = activities.map(act => {
      const key = `${act.chain.toLowerCase()}:${act.token_address.toLowerCase()}`;
      const mexc = listingMap.get(key);

      const isListedOnMexc = !!mexc;
      const isPreListingBuy = mexc ? act.first_buy_timestamp < mexc.listing_timestamp : false;
      const isHit = isListedOnMexc && isPreListingBuy;

      const leadSeconds = mexc ? (mexc.listing_timestamp - act.first_buy_timestamp) / 1000 : 0;

      return {
        token_address: act.token_address,
        chain: act.chain,
        symbol: mexc?.symbol || 'UNKNOWN',
        name: mexc?.name || 'Unknown Token',
        buy_timestamp: act.first_buy_timestamp,
        buy_date: new Date(act.first_buy_timestamp).toISOString(),
        mexc_listing_timestamp: mexc ? mexc.listing_timestamp : null,
        mexc_listing_date: mexc ? new Date(mexc.listing_timestamp).toISOString() : null,
        result: isHit ? ('HIT' as const) : ('MISS' as const),
        lead_time_seconds: Math.max(0, leadSeconds),
        lead_time_days: leadSeconds > 0 ? Number((leadSeconds / 86400).toFixed(1)) : 0,
        buy_count: act.buy_count
      };
    });

    // Sort: HITs first, then newest buy date
    tokenHistory.sort((a, b) => {
      if (a.result === 'HIT' && b.result !== 'HIT') return -1;
      if (a.result !== 'HIT' && b.result === 'HIT') return 1;
      return b.buy_timestamp - a.buy_timestamp;
    });

    return {
      stats,
      tokens: tokenHistory
    };
  }
}

export const walletAnalytics = new WalletAnalyticsEngine();
