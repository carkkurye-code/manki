import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { logger } from './logger.js';
import { MexcListing, DexTrade, WalletTokenActivity, WalletStats, AlertRecord } from './types.js';

const dbPath = path.resolve(process.cwd(), 'tracker.db');
export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  // 1. mexc_listings
  db.exec(`
    CREATE TABLE IF NOT EXISTS mexc_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_address TEXT NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      chain TEXT NOT NULL,
      listing_timestamp INTEGER NOT NULL,
      listing_url TEXT,
      is_meme TEXT DEFAULT 'unknown',
      created_at INTEGER NOT NULL,
      UNIQUE(chain, token_address)
    );
  `);

  // 2. dex_trades
  db.exec(`
    CREATE TABLE IF NOT EXISTS dex_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT NOT NULL,
      chain TEXT NOT NULL,
      dex TEXT NOT NULL,
      token_address TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      side TEXT NOT NULL,
      amount REAL DEFAULT 0,
      input_token TEXT,
      output_token TEXT,
      UNIQUE(tx_hash, chain)
    );
  `);

  // 3. wallet_token_activity
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_token_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      token_address TEXT NOT NULL,
      chain TEXT NOT NULL,
      first_buy_timestamp INTEGER NOT NULL,
      last_buy_timestamp INTEGER NOT NULL,
      buy_count INTEGER DEFAULT 1,
      first_seen_before_listing INTEGER DEFAULT 0,
      seconds_before_listing REAL DEFAULT 0,
      UNIQUE(wallet_address, token_address, chain)
    );
  `);

  // 4. wallet_stats
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_stats (
      wallet_address TEXT PRIMARY KEY,
      total_pre_listing_buys INTEGER DEFAULT 0,
      mexc_hits INTEGER DEFAULT 0,
      non_mexc_buys INTEGER DEFAULT 0,
      historical_hit_rate REAL DEFAULT 0,
      avg_lead_time REAL DEFAULT 0,
      median_lead_time REAL DEFAULT 0,
      chains TEXT DEFAULT '',
      first_seen INTEGER DEFAULT 0,
      last_seen INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);

  // 5. alerts
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_address TEXT NOT NULL,
      chain TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      telegram_message_id TEXT
    );
  `);

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mexc_symbol ON mexc_listings(symbol);
    CREATE INDEX IF NOT EXISTS idx_mexc_token ON mexc_listings(token_address, chain);
    CREATE INDEX IF NOT EXISTS idx_dex_wallet ON dex_trades(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_dex_token ON dex_trades(token_address, chain);
    CREATE INDEX IF NOT EXISTS idx_dex_timestamp ON dex_trades(timestamp);
    CREATE INDEX IF NOT EXISTS idx_activity_wallet ON wallet_token_activity(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_activity_token ON wallet_token_activity(token_address, chain);
    CREATE INDEX IF NOT EXISTS idx_wallet_stats_rate ON wallet_stats(historical_hit_rate DESC, total_pre_listing_buys DESC);
  `);

  logger.system('Database initialized successfully with SQLite schema and indexes.');
}

// Auto-initialize on module load
initDatabase();

// Database helper functions
export const dbHelpers = {
  // MEXC Listings
  insertListing(listing: MexcListing): boolean {
    try {
      const stmt = db.prepare(`
        INSERT INTO mexc_listings (
          token_address, symbol, name, chain, listing_timestamp, listing_url, is_meme, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chain, token_address) DO UPDATE SET
          listing_timestamp = excluded.listing_timestamp,
          name = excluded.name,
          symbol = excluded.symbol,
          is_meme = excluded.is_meme
      `);
      stmt.run(
        listing.token_address,
        listing.symbol,
        listing.name,
        listing.chain,
        listing.listing_timestamp,
        listing.listing_url || '',
        listing.is_meme || 'unknown',
        listing.created_at || Date.now()
      );
      return true;
    } catch (err: any) {
      logger.system(`Error inserting listing ${listing.symbol}: ${err.message}`, 'error');
      return false;
    }
  },

  getAllListings(): MexcListing[] {
    const stmt = db.prepare('SELECT * FROM mexc_listings ORDER BY listing_timestamp DESC');
    return stmt.all() as unknown as MexcListing[];
  },

  getListing(chain: string, tokenAddress: string): MexcListing | undefined {
    const stmt = db.prepare('SELECT * FROM mexc_listings WHERE chain = ? AND LOWER(token_address) = LOWER(?) LIMIT 1');
    return stmt.get(chain, tokenAddress) as unknown as MexcListing | undefined;
  },

  // DEX Trades
  insertTrade(trade: DexTrade): boolean {
    try {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO dex_trades (
          tx_hash, chain, dex, token_address, wallet_address, timestamp, side, amount, input_token, output_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        trade.tx_hash,
        trade.chain,
        trade.dex,
        trade.token_address,
        trade.wallet_address,
        trade.timestamp,
        trade.side,
        trade.amount || 0,
        trade.input_token || '',
        trade.output_token || ''
      );
      return true;
    } catch (err: any) {
      logger.dex(`Error inserting trade ${trade.tx_hash}: ${err.message}`, 'error');
      return false;
    }
  },

  getTradesForToken(chain: string, tokenAddress: string): DexTrade[] {
    const stmt = db.prepare(`
      SELECT * FROM dex_trades 
      WHERE chain = ? AND LOWER(token_address) = LOWER(?)
      ORDER BY timestamp ASC
    `);
    return stmt.all(chain, tokenAddress) as unknown as DexTrade[];
  },

  getTradesForWallet(walletAddress: string): DexTrade[] {
    const stmt = db.prepare(`
      SELECT * FROM dex_trades 
      WHERE LOWER(wallet_address) = LOWER(?)
      ORDER BY timestamp DESC
    `);
    return stmt.all(walletAddress) as unknown as DexTrade[];
  },

  // Wallet Token Activity
  upsertWalletActivity(act: WalletTokenActivity): boolean {
    try {
      const stmt = db.prepare(`
        INSERT INTO wallet_token_activity (
          wallet_address, token_address, chain, first_buy_timestamp, last_buy_timestamp,
          buy_count, first_seen_before_listing, seconds_before_listing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(wallet_address, token_address, chain) DO UPDATE SET
          last_buy_timestamp = MAX(wallet_token_activity.last_buy_timestamp, excluded.last_buy_timestamp),
          first_buy_timestamp = MIN(wallet_token_activity.first_buy_timestamp, excluded.first_buy_timestamp),
          buy_count = wallet_token_activity.buy_count + 1,
          first_seen_before_listing = excluded.first_seen_before_listing,
          seconds_before_listing = excluded.seconds_before_listing
      `);
      stmt.run(
        act.wallet_address,
        act.token_address,
        act.chain,
        act.first_buy_timestamp,
        act.last_buy_timestamp,
        act.buy_count || 1,
        act.first_seen_before_listing,
        act.seconds_before_listing
      );
      return true;
    } catch (err: any) {
      logger.wallet(`Error upserting activity: ${err.message}`, 'error');
      return false;
    }
  },

  getWalletActivities(walletAddress: string): WalletTokenActivity[] {
    const stmt = db.prepare('SELECT * FROM wallet_token_activity WHERE LOWER(wallet_address) = LOWER(?) ORDER BY first_buy_timestamp DESC');
    return stmt.all(walletAddress) as unknown as WalletTokenActivity[];
  },

  // Wallet Stats
  upsertWalletStats(stats: WalletStats): boolean {
    try {
      const stmt = db.prepare(`
        INSERT INTO wallet_stats (
          wallet_address, total_pre_listing_buys, mexc_hits, non_mexc_buys,
          historical_hit_rate, avg_lead_time, median_lead_time, chains, first_seen, last_seen, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET
          total_pre_listing_buys = excluded.total_pre_listing_buys,
          mexc_hits = excluded.mexc_hits,
          non_mexc_buys = excluded.non_mexc_buys,
          historical_hit_rate = excluded.historical_hit_rate,
          avg_lead_time = excluded.avg_lead_time,
          median_lead_time = excluded.median_lead_time,
          chains = excluded.chains,
          first_seen = excluded.first_seen,
          last_seen = excluded.last_seen,
          updated_at = excluded.updated_at
      `);
      stmt.run(
        stats.wallet_address,
        stats.total_pre_listing_buys,
        stats.mexc_hits,
        stats.non_mexc_buys,
        stats.historical_hit_rate,
        stats.avg_lead_time,
        stats.median_lead_time,
        stats.chains,
        stats.first_seen,
        stats.last_seen,
        stats.updated_at
      );
      return true;
    } catch (err: any) {
      logger.wallet(`Error upserting wallet stats: ${err.message}`, 'error');
      return false;
    }
  },

  getAllWalletStats(minSample = 0, minRate = 0): WalletStats[] {
    const stmt = db.prepare(`
      SELECT * FROM wallet_stats 
      WHERE total_pre_listing_buys >= ? AND historical_hit_rate >= ?
      ORDER BY historical_hit_rate DESC, total_pre_listing_buys DESC
    `);
    return stmt.all(minSample, minRate) as unknown as WalletStats[];
  },

  getWalletStats(walletAddress: string): WalletStats | undefined {
    const stmt = db.prepare('SELECT * FROM wallet_stats WHERE LOWER(wallet_address) = LOWER(?) LIMIT 1');
    return stmt.get(walletAddress) as unknown as WalletStats | undefined;
  },

  // Alerts
  insertAlert(alert: AlertRecord): number {
    try {
      const stmt = db.prepare(`
        INSERT INTO alerts (token_address, chain, wallet_address, alert_type, message_text, created_at, telegram_message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info: any = stmt.run(
        alert.token_address,
        alert.chain,
        alert.wallet_address,
        alert.alert_type,
        alert.message_text,
        alert.created_at,
        alert.telegram_message_id || ''
      );
      return info.lastInsertRowid ? Number(info.lastInsertRowid) : 1;
    } catch (err: any) {
      logger.alert(`Error inserting alert: ${err.message}`, 'error');
      return 0;
    }
  },

  hasAlerted(walletAddress: string, tokenAddress: string, chain: string): boolean {
    const stmt = db.prepare(`
      SELECT id FROM alerts 
      WHERE LOWER(wallet_address) = LOWER(?) 
        AND LOWER(token_address) = LOWER(?) 
        AND LOWER(chain) = LOWER(?) 
      LIMIT 1
    `);
    const row = stmt.get(walletAddress, tokenAddress, chain);
    return !!row;
  },

  getAllAlerts(limit = 50): AlertRecord[] {
    const stmt = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as unknown as AlertRecord[];
  },

  // Global aggregate stats
  clearHistoricalTradesAndWallets(): void {
    try {
      db.exec(`
        DELETE FROM dex_trades;
        DELETE FROM wallet_token_activity;
        DELETE FROM wallet_stats;
      `);
      logger.system('Cleared old historical trades and wallet stats from SQLite database.');
    } catch (err: any) {
      logger.system(`Error clearing historical database: ${err.message}`, 'warn');
    }
  },

  getDashboardStats() {
    const listingRow: any = db.prepare('SELECT COUNT(*) as count FROM mexc_listings').get();
    const walletRow: any = db.prepare('SELECT COUNT(*) as count FROM wallet_stats').get();
    const buysRow: any = db.prepare('SELECT SUM(total_pre_listing_buys) as totalBuys, SUM(mexc_hits) as totalHits FROM wallet_stats').get();
    const tradesCountRow: any = db.prepare('SELECT COUNT(*) as count FROM dex_trades').get();

    return {
      mexcListingsAnalyzed: listingRow?.count || 0,
      smartWalletsFound: walletRow?.count || 0,
      totalPreListingBuys: buysRow?.totalBuys || 0,
      totalMexcHits: buysRow?.totalHits || 0,
      totalDexTrades: tradesCountRow?.count || 0
    };
  }
};
