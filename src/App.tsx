import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { SmartWalletsTable } from './components/SmartWalletsTable';
import { WalletDetailModal } from './components/WalletDetailModal';
import { MexcListingsView } from './components/MexcListingsView';
import { LiveAlertsPanel } from './components/LiveAlertsPanel';
import { HistoricalAnalysisView } from './components/HistoricalAnalysisView';
import { TestSuiteModal } from './components/TestSuiteModal';
import { TelegramConfigModal } from './components/TelegramConfigModal';
import { LogsDrawer } from './components/LogsDrawer';
import { DashboardStats, WalletStats, MexcListing, AlertRecord } from './types';
import { api } from './api';
import { Users, Layers, Bell, Shield, ExternalLink, HelpCircle, History } from 'lucide-react';

export default function App() {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [wallets, setWallets] = useState<WalletStats[]>([]);
  const [listings, setListings] = useState<MexcListing[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pipelineRunning, setPipelineRunning] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'wallets' | 'listings' | 'alerts' | 'historical'>('historical');

  // Modals
  const [selectedWallet, setSelectedWallet] = useState<WalletStats | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState<boolean>(false);

  // Load all initial data
  const loadData = useCallback(async () => {
    try {
      const [statsData, walletsData, listingsData, alertsData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getWallets(0, 0).catch(() => []),
        api.getListings().catch(() => []),
        api.getAlerts().catch(() => [])
      ]);

      if (statsData) setStats(statsData);
      setWallets(walletsData);
      setListings(listingsData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll stats and alerts periodically every 10 seconds
    const interval = setInterval(() => {
      api.getStats().then(s => setStats(s)).catch(() => {});
      api.getAlerts().then(a => setAlerts(a)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Actions
  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    try {
      await api.runFullPipeline();
      await loadData();
    } catch (err: any) {
      console.error('Pipeline run error:', err);
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleToggleMonitor = async () => {
    try {
      const res = await api.toggleLiveMonitor();
      setStats(prev => prev ? {
        ...prev,
        liveMonitor: {
          ...prev.liveMonitor,
          active: res.active
        }
      } : prev);
    } catch (err) {
      console.error('Monitor toggle error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 text-zinc-900 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header with Navigation & Live Status */}
      <Header
        stats={stats}
        loading={loading}
        onRefresh={loadData}
        onRunPipeline={handleRunPipeline}
        onToggleMonitor={handleToggleMonitor}
        onOpenTests={() => setIsTestModalOpen(true)}
        onOpenTelegram={() => setIsTelegramModalOpen(true)}
        onOpenLogs={() => setIsLogsDrawerOpen(true)}
        pipelineRunning={pipelineRunning}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Cards (Section 25) */}
        <StatsCards stats={stats} loading={loading} />

        {/* View Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-200">
          <nav className="flex space-x-2 -mb-px">
            <button
              id="tab-wallets"
              onClick={() => setActiveTab('wallets')}
              className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'wallets'
                  ? 'border-emerald-600 text-emerald-700 bg-white/70 rounded-t-lg'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Smart Wallets</span>
              <span className="ml-1.5 px-2 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 rounded-full font-mono">
                {wallets.length}
              </span>
            </button>

            <button
              id="tab-listings"
              onClick={() => setActiveTab('listings')}
              className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'listings'
                  ? 'border-emerald-600 text-emerald-700 bg-white/70 rounded-t-lg'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>MEXC Listings Database</span>
              <span className="ml-1.5 px-2 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 rounded-full font-mono">
                {listings.length}
              </span>
            </button>

            <button
              id="tab-alerts"
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'alerts'
                  ? 'border-emerald-600 text-emerald-700 bg-white/70 rounded-t-lg'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Live Signals & Alerts</span>
              <span className="ml-1.5 px-2 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 rounded-full font-mono">
                {alerts.length}
              </span>
            </button>

            <button
              id="tab-historical"
              onClick={() => setActiveTab('historical')}
              className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'historical'
                  ? 'border-indigo-600 text-indigo-700 bg-white/70 rounded-t-lg'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Historical Pre-Listing Analysis</span>
              <span className="ml-1.5 px-2 py-0.5 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-mono font-bold">
                Robinhood RPC
              </span>
            </button>
          </nav>

          <div className="hidden sm:flex items-center space-x-2 text-xs text-zinc-500 font-mono">
            <span>Window: <code>24h Pre-Listing Cutoff</code></span>
          </div>
        </div>

        {/* Tab View Content */}
        <div>
          {activeTab === 'historical' && (
            <HistoricalAnalysisView />
          )}

          {activeTab === 'wallets' && (
            <SmartWalletsTable
              wallets={wallets}
              loading={loading}
              onSelectWallet={(w) => setSelectedWallet(w)}
            />
          )}

          {activeTab === 'listings' && (
            <MexcListingsView
              listings={listings}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'alerts' && (
            <LiveAlertsPanel
              alerts={alerts}
              wallets={wallets}
              onRefreshAlerts={() => api.getAlerts().then(setAlerts)}
            />
          )}
        </div>

        {/* Mandatory Research Disclaimer Card (Section 17 & 21) */}
        <footer className="pt-4 pb-8 border-t border-zinc-200">
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-500 space-y-2">
            <div className="flex items-center space-x-2 text-zinc-800 font-semibold">
              <Shield className="w-4 h-4 text-zinc-600" />
              <span>MEXC Smart Wallet Tracker — Methodology & Constraints</span>
            </div>
            <p className="leading-relaxed">
              This system is an analytical intelligence tool tracking historical on-chain DEX swaps occurring prior to verified MEXC exchange listing timestamps ($T=0$). It does not use Machine Learning, does not predict market caps, and does not execute automated trades. A high historical hit rate indicates that a wallet repeatedly purchased tokens that were later listed on MEXC, but is strictly <b>NOT a guarantee of future MEXC listings</b>.
            </p>
            <div className="flex flex-wrap gap-4 pt-1 font-mono text-[11px] text-zinc-400">
              <span>Data sources: MEXC Public API • Bitquery GraphQL v2 • DexScreener</span>
              <span>Storage: Embedded SQLite with WAL mode</span>
              <span>Telegram Bot: Active</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Modals and Drawers */}
      <WalletDetailModal
        wallet={selectedWallet}
        onClose={() => setSelectedWallet(null)}
      />

      <TestSuiteModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />

      <TelegramConfigModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        onSaved={loadData}
        currentConfig={stats?.telegram}
      />

      <LogsDrawer
        isOpen={isLogsDrawerOpen}
        onClose={() => setIsLogsDrawerOpen(false)}
      />
    </div>
  );
}
