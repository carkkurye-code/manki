import { logger } from './logger.js';
import { dbHelpers, db } from './db.js';
import { telegramAlerts } from './telegramAlerts.js';
import { WalletStats } from './types.js';

export class LiveMonitorEngine {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 30000; // 30 seconds
  private lastCheckTimestamp: number = 0;

  isActive(): boolean {
    return this.isRunning;
  }

  getStatus() {
    const watchedWallets = dbHelpers.getAllWalletStats(2, 50); // min 2 buys, 50% hit rate
    return {
      active: this.isRunning,
      watchedWalletsCount: watchedWallets.length,
      lastCheckTimestamp: this.lastCheckTimestamp,
      intervalMs: this.checkIntervalMs
    };
  }

  start() {
    if (this.isRunning) {
      logger.system('Live DEX monitor is already running.');
      return;
    }

    this.isRunning = true;
    logger.system('Starting Live Smart Wallet DEX Monitor (Polling every 30s)...', 'success');

    // Run first check immediately
    this.pollCycle();

    this.intervalId = setInterval(() => {
      this.pollCycle();
    }, this.checkIntervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.system('Live Smart Wallet DEX Monitor stopped.');
  }

  async pollCycle() {
    this.lastCheckTimestamp = Date.now();
    const watchedWallets = dbHelpers.getAllWalletStats(2, 50);

    if (watchedWallets.length === 0) {
      logger.wallet('No smart wallets eligible for watching yet (requires sample size >= 2, hit rate >= 50%). Run collector first.', 'warn');
      return;
    }

    logger.wallet(`[Live Monitor] Watching ${watchedWallets.length} qualified Smart Wallets for new DEX BUY operations...`);

    // Group active tokens from recent trades to check for multi-wallet overlap
    const recentActivity = db.prepare(`
      SELECT token_address, chain, COUNT(DISTINCT wallet_address) as wallet_count
      FROM wallet_token_activity
      GROUP BY token_address, chain
      HAVING wallet_count > 1
    `).all() as { token_address: string; chain: string; wallet_count: number }[];

    for (const group of recentActivity) {
      // Check if all wallets in this group are smart wallets
      const groupWallets = db.prepare(`
        SELECT DISTINCT wallet_address FROM wallet_token_activity
        WHERE LOWER(token_address) = LOWER(?) AND LOWER(chain) = LOWER(?)
      `).all(group.token_address, group.chain) as { wallet_address: string }[];

      const matchedSmartWallets: WalletStats[] = [];
      for (const gw of groupWallets) {
        const stats = dbHelpers.getWalletStats(gw.wallet_address);
        if (stats && stats.total_pre_listing_buys >= 2 && stats.historical_hit_rate >= 50) {
          matchedSmartWallets.push(stats);
        }
      }

      if (matchedSmartWallets.length >= 2) {
        // Resolve symbol if possible
        const listing = dbHelpers.getListing(group.chain, group.token_address);
        const symbol = listing?.symbol || 'TOKEN';

        // Check if an aggregated alert already fired for this token
        const hasAggAlert = db.prepare(`
          SELECT id FROM alerts WHERE alert_type = 'AGGREGATED' AND LOWER(token_address) = LOWER(?)
        `).get(group.token_address);

        if (!hasAggAlert) {
          await telegramAlerts.processMultiWalletSignal(group.token_address, symbol, group.chain, matchedSmartWallets);
        }
      }
    }
  }

  // Trigger manual test signal / ingestion
  async simulateLiveBuy(walletAddress: string, tokenAddress: string, tokenSymbol: string, chain: string, amount = 1.5) {
    const stats = dbHelpers.getWalletStats(walletAddress);
    if (!stats) {
      throw new Error(`Wallet ${walletAddress} does not exist in smart wallet database.`);
    }

    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const now = Date.now();

    // 1. Record DEX trade
    dbHelpers.insertTrade({
      tx_hash: txHash,
      chain,
      dex: 'raydium',
      token_address: tokenAddress,
      wallet_address: walletAddress,
      timestamp: now,
      side: 'BUY',
      amount,
      input_token: 'SOL',
      output_token: tokenAddress
    });

    // 2. Update wallet_token_activity
    dbHelpers.upsertWalletActivity({
      wallet_address: walletAddress,
      token_address: tokenAddress,
      chain,
      first_buy_timestamp: now,
      last_buy_timestamp: now,
      buy_count: 1,
      first_seen_before_listing: 0,
      seconds_before_listing: 0
    });

    // 3. Check for multi-wallet signal
    const buyers = db.prepare(`
      SELECT DISTINCT wallet_address FROM wallet_token_activity
      WHERE LOWER(token_address) = LOWER(?) AND LOWER(chain) = LOWER(?)
    `).all(tokenAddress, chain) as { wallet_address: string }[];

    const smartBuyers: WalletStats[] = [];
    for (const b of buyers) {
      const s = dbHelpers.getWalletStats(b.wallet_address);
      if (s) smartBuyers.push(s);
    }

    if (smartBuyers.length >= 2) {
      await telegramAlerts.processMultiWalletSignal(tokenAddress, tokenSymbol, chain, smartBuyers);
      return { type: 'AGGREGATED', smartBuyersCount: smartBuyers.length };
    } else {
      await telegramAlerts.processWalletBuy({
        wallet: stats,
        tokenAddress,
        tokenSymbol,
        chain,
        amount,
        txHash,
        buyTimestamp: now
      });
      return { type: 'SINGLE_WALLET', wallet: stats.wallet_address };
    }
  }
}

export const liveMonitor = new LiveMonitorEngine();
