import React, { useState } from 'react';
import { Bell, ShieldAlert, Send, Play, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { AlertRecord, WalletStats } from '../types';
import { api } from '../api';

interface LiveAlertsPanelProps {
  alerts: AlertRecord[];
  wallets: WalletStats[];
  onRefreshAlerts: () => void;
}

export const LiveAlertsPanel: React.FC<LiveAlertsPanelProps> = ({ alerts, wallets, onRefreshAlerts }) => {
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simTokenSymbol, setSimTokenSymbol] = useState<string>('PEPE3');
  const [simTokenAddress, setSimTokenAddress] = useState<string>('0x_live_simulation_' + Date.now().toString().slice(-4));
  const [simChain, setSimChain] = useState<string>('ethereum');
  const [selectedWallet, setSelectedWallet] = useState<string>(wallets[0]?.wallet_address || '');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSimulateBuy = async () => {
    if (!selectedWallet && wallets.length > 0) {
      setSelectedWallet(wallets[0].wallet_address);
    }
    const walletToUse = selectedWallet || wallets[0]?.wallet_address;
    if (!walletToUse) return;

    setSimulating(true);
    setFeedback(null);
    try {
      const res = await api.simulateBuy({
        walletAddress: walletToUse,
        tokenAddress: simTokenAddress,
        tokenSymbol: simTokenSymbol,
        chain: simChain,
        amount: 1500
      });
      setFeedback(res.message || 'Simulation trade executed!');
      onRefreshAlerts();
    } catch (err: any) {
      setFeedback('Simulation error: ' + err.message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
              Live DEX Smart Wallet Signals
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 rounded-md border border-rose-200">
              {alerts.length} Triggered
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Real-time notifications triggered when high-conviction smart wallets purchase new unlisted tokens
          </p>
        </div>

        {/* Anti-spam badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-[11px] text-zinc-600">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
          <span>Anti-Spam Active (1 alert/wallet/token)</span>
        </div>
      </div>

      {/* Simulator bar */}
      <div className="p-4 bg-zinc-50/70 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-800 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Interactive Live Alert Simulator:</span>
          </span>
          <span className="text-[11px] text-zinc-500">Test single & multi-wallet trigger pipelines</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">Smart Wallet</label>
            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md font-mono"
            >
              {wallets.slice(0, 8).map(w => (
                <option key={w.wallet_address} value={w.wallet_address}>
                  {w.wallet_address.slice(0, 10)}... ({w.historical_hit_rate}% - n={w.total_pre_listing_buys})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">Token Symbol</label>
            <input
              type="text"
              value={simTokenSymbol}
              onChange={(e) => setSimTokenSymbol(e.target.value.toUpperCase())}
              className="w-full px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">Chain</label>
            <select
              value={simChain}
              onChange={(e) => setSimChain(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md uppercase"
            >
              <option value="ethereum">Ethereum</option>
              <option value="solana">Solana</option>
              <option value="base">Base</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              id="btn-trigger-simulate"
              onClick={handleSimulateBuy}
              disabled={simulating}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{simulating ? 'Injecting Trade...' : 'Simulate DEX Buy'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            {feedback}
          </div>
        )}
      </div>

      {/* Alerts list */}
      <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            No live alerts recorded yet. Click "Simulate DEX Buy" above or enable the Live Monitor to detect trades automatically.
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="p-4 hover:bg-zinc-50/70 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${
                    alert.alert_type === 'AGGREGATED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-zinc-900 font-mono">
                        {alert.alert_type === 'AGGREGATED' ? '🚨 MULTI-WALLET AGGREGATED SIGNAL' : '🎯 SMART WALLET DETECTED'}
                      </span>
                      <span className="px-1.5 py-0.2 text-[10px] font-semibold uppercase bg-zinc-100 text-zinc-700 rounded border border-zinc-200">
                        {alert.chain}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-700 font-mono bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 whitespace-pre-line">
                      {alert.message_text.replace(/<[^>]*>?/gm, '')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
