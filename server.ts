import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initDatabase, dbHelpers } from './server/db.js';
import { mexcCollector } from './server/mexcCollector.js';
import { dexCollector } from './server/dexCollector.js';
import { walletAnalytics } from './server/walletAnalytics.js';
import { liveMonitor } from './server/liveMonitor.js';
import { telegramAlerts } from './server/telegramAlerts.js';
import { runSystemTests, runHistoricalMexcTests } from './server/testRunner.js';
import { logger } from './server/logger.js';
import { robinhoodRpc } from './server/robinhoodRpc.js';
import { historicalMexcAnalyzer } from './server/historicalMexcAnalyzer.js';

dotenv.config();

// Initialize Database
initDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // 1. Dashboard summary stats
  app.get('/api/stats', (req, res) => {
    try {
      const stats = dbHelpers.getDashboardStats();
      const liveStatus = liveMonitor.getStatus();
      const tgStatus = telegramAlerts.getCredentialsInfo();
      res.json({
        ...stats,
        liveMonitor: liveStatus,
        telegram: tgStatus,
        bitquery: { configured: dexCollector.hasApiKey() },
        mexc: { configured: !!(process.env.MEXC_API_KEY && process.env.MEXC_API_KEY.trim()) }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Smart Wallets Table
  app.get('/api/wallets', (req, res) => {
    try {
      const minSample = parseInt(req.query.minSample as string) || 0;
      const minRate = parseFloat(req.query.minRate as string) || 0;
      const wallets = dbHelpers.getAllWalletStats(minSample, minRate);
      res.json(wallets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Wallet Detailed Token History
  app.get('/api/wallets/:address', (req, res) => {
    try {
      const addr = req.params.address;
      const detail = walletAnalytics.getWalletDetailedHistory(addr);
      if (!detail) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. MEXC Listings
  app.get('/api/listings', (req, res) => {
    try {
      const listings = dbHelpers.getAllListings();
      res.json(listings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger Phase 1 MEXC listings collector
  app.post('/api/listings/collect', async (req, res) => {
    try {
      const limit = parseInt(req.body?.limit) || 20;
      const memeOnly = req.body?.memeOnly !== false;
      const listings = await mexcCollector.collectHistoricalListings(limit, memeOnly);
      res.json({ success: true, count: listings.length, listings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger Phase 3 & 4 DEX trades collector
  app.post('/api/trades/collect', async (req, res) => {
    try {
      const limit = parseInt(req.body?.limit) || 10;
      // Run in background / async
      dexCollector.collectTradesForAllListings(limit).then(() => {
        walletAnalytics.recalculateAllWalletStats();
      }).catch(err => {
        logger.dex(`Background trade collection failed: ${err.message}`, 'error');
      });
      res.json({ success: true, message: `Started DEX trade collection for up to ${limit} listings.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger Phase 5 Wallet stats recalculation
  app.post('/api/analytics/recalculate', (req, res) => {
    try {
      const result = walletAnalytics.recalculateAllWalletStats();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Full Pipeline Execution (Phase 1 -> 3 -> 4 -> 5)
  app.post('/api/pipeline/run-all', async (req, res) => {
    try {
      logger.system('Executing End-to-End Pipeline: Fetch Listings -> DEX Trades -> Wallet Analytics...', 'info');
      // Step 1: Collect Listings
      const listings = await mexcCollector.collectHistoricalListings(15, true);
      // Step 2: Trades
      await dexCollector.collectTradesForAllListings(10);
      // Step 3: Analytics
      const stats = walletAnalytics.recalculateAllWalletStats();

      res.json({
        success: true,
        listingsCollected: listings.length,
        walletsAnalyzed: stats.totalWalletsProcessed,
        smartWalletsFound: stats.smartWalletsFound
      });
    } catch (err: any) {
      logger.system(`Pipeline failed: ${err.message}`, 'error');
      res.status(500).json({ error: err.message });
    }
  });

  // Bitquery Diagnostic Verification Endpoint
  app.get('/api/bitquery/verify', async (req, res) => {
    try {
      const verification = await dexCollector.verifyConnection();
      res.json(verification);
    } catch (err: any) {
      res.status(500).json({
        configured: false,
        authValid: false,
        evmValid: false,
        solanaValid: false,
        error: err.message
      });
    }
  });

  // MEXC API Diagnostic Verification Endpoint
  app.get('/api/mexc/verify', async (req, res) => {
    try {
      const verification = await mexcCollector.verifyAuth();
      res.json(verification);
    } catch (err: any) {
      res.status(500).json({
        configured: false,
        authenticated: false,
        readOnly: true,
        listingApi: false,
        error: err.message
      });
    }
  });

  // DEX Screener Diagnostic Verification Endpoint (Read-only)
  app.get('/api/dexscreener/verify', async (req, res) => {
    try {
      const tokenRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4Eb990547BCe4a982432CA88Cf5fae7EED1A2d35', {
        headers: { 'User-Agent': 'MEXC-Smart-Wallet-Tracker/1.0' }
      });
      const isApiOk = tokenRes.ok;
      const data = isApiOk ? await tokenRes.json() : null;

      const robinhoodPair = data?.pairs?.find((p: any) => p.chainId === 'robinhood');
      const isRobinhoodChainOk = Boolean(robinhoodPair);
      const isTokenPairOk = Boolean(
        robinhoodPair?.baseToken?.address &&
        robinhoodPair?.pairAddress &&
        robinhoodPair?.priceUsd &&
        robinhoodPair?.txns
      );

      // DEX Screener API only supplies aggregated intervals (m5, h1, h6, h24 buys/sells).
      // It does NOT expose wallet/trader addresses or individual swap transactions.
      res.json({
        dexScreenerApi: isApiOk ? 'OK' : 'FAIL',
        robinhoodChainData: isRobinhoodChainOk ? 'OK' : 'FAIL',
        tokenPairData: isTokenPairOk ? 'OK' : 'FAIL',
        walletTraderData: 'Not available',
        pairSample: robinhoodPair ? {
          chainId: robinhoodPair.chainId,
          pairAddress: robinhoodPair.pairAddress,
          baseToken: robinhoodPair.baseToken,
          quoteToken: robinhoodPair.quoteToken,
          priceUsd: robinhoodPair.priceUsd,
          liquidityUsd: robinhoodPair.liquidity?.usd,
          txnsAggregated: robinhoodPair.txns
        } : null
      });
    } catch (err: any) {
      res.status(500).json({
        dexScreenerApi: 'FAIL',
        robinhoodChainData: 'FAIL',
        tokenPairData: 'FAIL',
        walletTraderData: 'Not available',
        error: err.message
      });
    }
  });

  // Robinhood RPC Status Endpoint (Read-only)
  app.get('/api/rpc/status', async (req, res) => {
    try {
      const chainId = await robinhoodRpc.eth_chainId();
      const latestBlock = await robinhoodRpc.eth_blockNumber();
      res.json({
        rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
        chainId,
        chainIdValid: chainId === 4663,
        latestBlock,
        status: 'OK'
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'FAIL',
        error: err.message
      });
    }
  });

  // Robinhood RPC Real Swap & Wallet MVP Test (Read-only on-chain, safe SQLite storage)
  app.post('/api/rpc/test-mvp', async (req, res) => {
    try {
      const blockRange = req.body?.blockRange ? Number(req.body.blockRange) : 200;
      const saveToDatabase = req.body?.saveToDatabase !== false;
      const result = await robinhoodRpc.processRealRobinhoodSwaps({
        blockRange,
        saveToDatabase
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        rpcOk: false,
        error: err.message
      });
    }
  });

  // Historical MEXC pre-listing & Robinhood on-chain wallet analysis
  app.post('/api/historical/analyze', async (req, res) => {
    try {
      const summary = await historicalMexcAnalyzer.runHistoricalAnalysis();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
        analysisStatus: 'INSUFFICIENT_HISTORICAL_DATA'
      });
    }
  });

  app.get('/api/historical/report', async (req, res) => {
    try {
      const cached = historicalMexcAnalyzer.getLastAnalysisSummary();
      if (cached) {
        return res.json(cached);
      }
      const summary = await historicalMexcAnalyzer.runHistoricalAnalysis();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
        analysisStatus: 'INSUFFICIENT_HISTORICAL_DATA'
      });
    }
  });

  // Alerts
  app.get('/api/alerts', (req, res) => {
    try {
      const alerts = dbHelpers.getAllAlerts(50);
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Logs stream / fetch
  app.get('/api/logs', (req, res) => {
    res.json(logger.getRecentLogs(150));
  });

  // Live Monitor controls
  app.get('/api/live-monitor/status', (req, res) => {
    res.json(liveMonitor.getStatus());
  });

  app.post('/api/live-monitor/toggle', (req, res) => {
    try {
      if (liveMonitor.isActive()) {
        liveMonitor.stop();
      } else {
        liveMonitor.start();
      }
      res.json(liveMonitor.getStatus());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/live-monitor/simulate-buy', async (req, res) => {
    try {
      const { walletAddress, tokenAddress, tokenSymbol, chain, amount } = req.body;
      const result = await liveMonitor.simulateLiveBuy(
        walletAddress,
        tokenAddress,
        tokenSymbol || 'TEST',
        chain || 'solana',
        amount || 1.0
      );
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Telegram Config and Test
  app.get('/api/telegram/config', (req, res) => {
    res.json(telegramAlerts.getCredentialsInfo());
  });

  app.post('/api/telegram/config', (req, res) => {
    try {
      const { token, chatId } = req.body;
      telegramAlerts.setCredentials(token || '', chatId || '');
      res.json({ success: true, ...telegramAlerts.getCredentialsInfo() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/telegram/test', async (req, res) => {
    try {
      const testMsg = [
        '<b>[TEST VERIFICATION]</b> MEXC Smart Wallet Tracker V1',
        'Telegram bot connection verified successfully.',
        `Timestamp: ${new Date().toISOString()}`
      ].join('\n');
      const result = await telegramAlerts.sendTelegramMessage(testMsg);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Run Test Suite (Tests 1 through 8)
  app.post('/api/tests/run', async (req, res) => {
    try {
      const results = await runSystemTests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Run Historical MEXC tests
  app.post('/api/historical/test', async (req, res) => {
    try {
      const results = await runHistoricalMexcTests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.system(`MEXC Smart Wallet Tracker server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
