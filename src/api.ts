import { DashboardStats, WalletStats, WalletDetailResponse, MexcListing, AlertRecord, SystemLog, TestResult, HistoricalAnalysisSummary } from './types';

export const api = {
  async getStats(): Promise<DashboardStats> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  async getWallets(minSample = 0, minRate = 0): Promise<WalletStats[]> {
    const res = await fetch(`/api/wallets?minSample=${minSample}&minRate=${minRate}`);
    if (!res.ok) throw new Error('Failed to fetch smart wallets');
    return res.json();
  },

  async getWalletDetail(address: string): Promise<WalletDetailResponse> {
    const res = await fetch(`/api/wallets/${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error('Failed to fetch wallet detail');
    return res.json();
  },

  async getListings(): Promise<MexcListing[]> {
    const res = await fetch('/api/listings');
    if (!res.ok) throw new Error('Failed to fetch listings');
    return res.json();
  },

  async triggerListingCollection(limit = 20, memeOnly = true): Promise<{ count: number }> {
    const res = await fetch('/api/listings/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, memeOnly })
    });
    if (!res.ok) throw new Error('Failed to start listing collection');
    return res.json();
  },

  async triggerTradeCollection(limit = 10): Promise<{ message: string }> {
    const res = await fetch('/api/trades/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit })
    });
    if (!res.ok) throw new Error('Failed to start trade collection');
    return res.json();
  },

  async triggerRecalculate(): Promise<{ totalWalletsProcessed: number; smartWalletsFound: number }> {
    const res = await fetch('/api/analytics/recalculate', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to recalculate wallet stats');
    return res.json();
  },

  async runFullPipeline(): Promise<any> {
    const res = await fetch('/api/pipeline/run-all', { method: 'POST' });
    if (!res.ok) throw new Error('Pipeline execution failed');
    return res.json();
  },

  async getAlerts(): Promise<AlertRecord[]> {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async getLogs(): Promise<SystemLog[]> {
    const res = await fetch('/api/logs');
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  async toggleLiveMonitor(): Promise<any> {
    const res = await fetch('/api/live-monitor/toggle', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle live monitor');
    return res.json();
  },

  async simulateBuy(payload: { walletAddress: string; tokenAddress: string; tokenSymbol: string; chain: string; amount?: number }): Promise<any> {
    const res = await fetch('/api/live-monitor/simulate-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Simulation failed');
    return res.json();
  },

  async saveTelegramConfig(token: string, chatId: string): Promise<any> {
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId })
    });
    if (!res.ok) throw new Error('Failed to update Telegram configuration');
    return res.json();
  },

  async testTelegram(): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/telegram/test', { method: 'POST' });
    return res.json();
  },

  async runTests(): Promise<TestResult[]> {
    const res = await fetch('/api/tests/run', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run system test suite');
    return res.json();
  },

  async getHistoricalReport(): Promise<HistoricalAnalysisSummary> {
    const res = await fetch('/api/historical/report');
    if (!res.ok) throw new Error('Failed to fetch historical report');
    return res.json();
  },

  async runHistoricalAnalysis(): Promise<HistoricalAnalysisSummary> {
    const res = await fetch('/api/historical/analyze', { method: 'POST' });
    if (!res.ok) throw new Error('Historical analysis failed');
    return res.json();
  },

  async runHistoricalTests(): Promise<TestResult[]> {
    const res = await fetch('/api/historical/test', { method: 'POST' });
    if (!res.ok) throw new Error('Historical tests failed');
    return res.json();
  }
};
