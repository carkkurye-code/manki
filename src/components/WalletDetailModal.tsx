import React, { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, Clock, ExternalLink, Calendar, Layers, AlertCircle, Copy, Check } from 'lucide-react';
import { WalletStats, WalletDetailResponse } from '../types';
import { api } from '../api';

interface WalletDetailModalProps {
  wallet: WalletStats | null;
  onClose: () => void;
}

export const WalletDetailModal: React.FC<WalletDetailModalProps> = ({ wallet, onClose }) => {
  const [data, setData] = useState<WalletDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    api.getWalletDetail(wallet.wallet_address)
      .then(res => setData(res))
      .catch(err => console.error('Failed to load wallet details:', err))
      .finally(() => setLoading(false));
  }, [wallet]);

  if (!wallet) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const misses = wallet.non_mexc_buys;
  const isSmallSample = wallet.total_pre_listing_buys < 3;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="modal-wallet-detail"
        className="bg-white rounded-2xl max-w-4xl w-full border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 flex items-start justify-between bg-zinc-50/70">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Wallet History & Performance Audit
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-zinc-200 text-zinc-700 rounded">
                {wallet.chains || 'multi-chain'}
              </span>
            </div>

            <div className="mt-1 flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-mono font-bold text-zinc-900 break-all">
                {wallet.wallet_address}
              </h3>
              <button
                onClick={copyAddress}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-200/60 transition-colors shrink-0"
                title="Copy address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Hit Rate */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Historical Hit Rate
              </span>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className={`text-2xl font-bold font-mono ${
                  wallet.historical_hit_rate >= 75 ? 'text-emerald-700' : 'text-zinc-900'
                }`}>
                  {wallet.historical_hit_rate}%
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">{wallet.mexc_hits} hits / {wallet.total_pre_listing_buys} tokens</span>
            </div>

            {/* Sample Size */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Sample Size
              </span>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className="text-2xl font-bold font-mono text-zinc-900">
                  {wallet.total_pre_listing_buys}
                </span>
                <span className="text-xs text-zinc-500 font-medium">tokens</span>
              </div>
              {isSmallSample ? (
                <span className="text-[10px] text-amber-600 font-medium">High variance (n &lt; 3)</span>
              ) : (
                <span className="text-[10px] text-emerald-600 font-medium">Statistical weight: Good</span>
              )}
            </div>

            {/* Hits vs Misses */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Hits vs Misses
              </span>
              <div className="mt-1 flex items-center space-x-2 font-mono text-sm font-semibold">
                <span className="text-emerald-700 flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-1 inline" /> {wallet.mexc_hits}
                </span>
                <span className="text-zinc-400">/</span>
                <span className="text-rose-600 flex items-center">
                  <XCircle className="w-3.5 h-3.5 mr-1 inline" /> {misses}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">MEXC vs Unlisted</span>
            </div>

            {/* Lead Time */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Avg Lead Time
              </span>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className="text-2xl font-bold font-mono text-zinc-900">
                  {(wallet.avg_lead_time / 86400).toFixed(1)}
                </span>
                <span className="text-xs text-zinc-500 font-medium">days</span>
              </div>
              <span className="text-[10px] text-zinc-500">
                Median: {(wallet.median_lead_time / 86400).toFixed(1)} days
              </span>
            </div>
          </div>

          {/* Section 14: Token History Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">
                  Historical Token Activity (Chronological)
                </h4>
                <p className="text-xs text-zinc-500">
                  Exact record of all tokens purchased by this wallet and their correlation with MEXC listings
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                Loading token records from database...
              </div>
            ) : !data?.tokens || data.tokens.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No token records found for this wallet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Token</th>
                      <th className="py-2.5 px-3">Chain</th>
                      <th className="py-2.5 px-3">DEX BUY Time</th>
                      <th className="py-2.5 px-3">MEXC Listing (T=0)</th>
                      <th className="py-2.5 px-3 text-right">Lead Time</th>
                      <th className="py-2.5 px-3 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.tokens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                        {/* Token */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-zinc-900 font-mono">
                              ${item.symbol}
                            </span>
                            <span className="text-zinc-500 text-[11px] truncate max-w-[120px]">
                              {item.name}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-zinc-400 block truncate max-w-[180px]">
                            {item.token_address}
                          </span>
                        </td>

                        {/* Chain */}
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
                            {item.chain}
                          </span>
                        </td>

                        {/* DEX BUY Time */}
                        <td className="py-2.5 px-3 font-mono text-zinc-700">
                          {new Date(item.buy_timestamp).toLocaleString()}
                        </td>

                        {/* MEXC Listing (T=0) */}
                        <td className="py-2.5 px-3 font-mono">
                          {item.mexc_listing_timestamp ? (
                            <span className="text-zinc-700">
                              {new Date(item.mexc_listing_timestamp).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Not Listed on MEXC</span>
                          )}
                        </td>

                        {/* Lead Time */}
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          {item.result === 'HIT' ? (
                            <span className="text-emerald-700">
                              {item.lead_time_days} days before
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        {/* Result: HIT / MISS */}
                        <td className="py-2.5 px-3 text-center">
                          {item.result === 'HIT' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle className="w-3 h-3 mr-1" /> HIT
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-300">
                              <XCircle className="w-3 h-3 mr-1" /> MISS
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Audit criteria: BUY timestamp &lt; MEXC listing timestamp ($T=0$)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
