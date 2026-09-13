import React, { useState, useMemo } from 'react';
import { Search, Filter, AlertTriangle, ExternalLink, ChevronRight, Copy, Check } from 'lucide-react';
import { WalletStats } from '../types';

interface SmartWalletsTableProps {
  wallets: WalletStats[];
  loading: boolean;
  onSelectWallet: (wallet: WalletStats) => void;
}

export const SmartWalletsTable: React.FC<SmartWalletsTableProps> = ({
  wallets,
  loading,
  onSelectWallet
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minSample, setMinSample] = useState<number>(0);
  const [minRate, setMinRate] = useState<number>(0);
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  // Filtered and sorted wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter(w => {
      // Search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        if (!w.wallet_address.toLowerCase().includes(q)) return false;
      }
      // Sample Size
      if (w.total_pre_listing_buys < minSample) return false;
      // Hit Rate
      if (w.historical_hit_rate < minRate) return false;
      // Chain
      if (chainFilter !== 'all' && !w.chains.toLowerCase().includes(chainFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [wallets, searchQuery, minSample, minRate, chainFilter]);

  // Lead time formatted
  const formatLeadTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0.0 d';
    const days = (seconds / 86400).toFixed(1);
    return `${days} days`;
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      {/* Table Header & Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
              Top Smart Wallets
            </h2>
            <p className="text-xs text-zinc-500">
              Ranked by repetitive pre-listing purchase frequency, sample size, and verified MEXC hit rate
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span>Showing <b>{filteredWallets.length}</b> of <b>{wallets.length}</b> wallets</span>
          </div>
        </div>

        {/* Filters bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              id="input-search-wallet"
              type="text"
              placeholder="Search wallet address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Min Sample Size (Section 12 requirement) */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-500 shrink-0 font-medium">Min Sample:</span>
            <select
              id="select-min-sample"
              value={minSample}
              onChange={(e) => setMinSample(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
            >
              <option value={0}>All Sample Sizes (n ≥ 0)</option>
              <option value={2}>Significant (n ≥ 2)</option>
              <option value={5}>Moderate (n ≥ 5)</option>
              <option value={10}>High Conviction (n ≥ 10)</option>
              <option value={15}>Institutional (n ≥ 15)</option>
            </select>
          </div>

          {/* Min Hit Rate */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-500 shrink-0 font-medium">Min Hit Rate:</span>
            <select
              id="select-min-rate"
              value={minRate}
              onChange={(e) => setMinRate(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
            >
              <option value={0}>All Rates (0% - 100%)</option>
              <option value={50}>≥ 50% Hit Rate</option>
              <option value={65}>≥ 65% Hit Rate</option>
              <option value={75}>≥ 75% Hit Rate</option>
              <option value={90}>≥ 90% Hit Rate</option>
            </select>
          </div>

          {/* Chain */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-500 shrink-0 font-medium">Chain:</span>
            <select
              id="select-chain-filter"
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
            >
              <option value="all">All Supported Chains</option>
              <option value="solana">Solana</option>
              <option value="ethereum">Ethereum</option>
              <option value="base">Base</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4 w-16 text-center">Rank</th>
              <th className="py-3 px-4">Wallet Address</th>
              <th className="py-3 px-4 text-right">Pre-Listing Buys</th>
              <th className="py-3 px-4 text-right">MEXC Hits</th>
              <th className="py-3 px-4 text-right">Historical Hit Rate</th>
              <th className="py-3 px-4 text-right">Avg Lead Time</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-400">
                  Loading smart wallets database...
                </td>
              </tr>
            ) : filteredWallets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-600 px-6">
                  {wallets.length === 0 ? (
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="font-semibold text-zinc-800 text-sm">No production smart wallets in database yet</p>
                      <p className="text-zinc-500 text-xs leading-relaxed">
                        To discover verified pre-listing buyers, ensure your <code className="px-1 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">BITQUERY_API_KEY</code> is set in <code className="px-1 py-0.5 bg-zinc-100 rounded text-zinc-700 font-mono">.env</code>, then click <b>Run Pipeline</b> in the top bar.
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Synthetic benchmark & test data is kept strictly isolated in the test sandbox and not shown as production results.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">No wallets match the specified criteria.</p>
                      <p className="text-zinc-400 text-xs mt-1">Try lowering the minimum sample size or hit rate filter.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredWallets.map((wallet, index) => {
                const isSmallSample = wallet.total_pre_listing_buys < 3;
                const isHighConviction = wallet.total_pre_listing_buys >= 10 && wallet.historical_hit_rate >= 70;

                return (
                  <tr
                    key={wallet.wallet_address}
                    id={`wallet-row-${wallet.wallet_address}`}
                    onClick={() => onSelectWallet(wallet)}
                    className="hover:bg-zinc-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Rank */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-zinc-500">
                      #{index + 1}
                    </td>

                    {/* Wallet Address + Chains */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-medium text-zinc-900 group-hover:text-emerald-600 transition-colors">
                          {wallet.wallet_address.length > 20
                            ? `${wallet.wallet_address.slice(0, 8)}...${wallet.wallet_address.slice(-6)}`
                            : wallet.wallet_address}
                        </span>

                        <button
                          onClick={(e) => handleCopy(wallet.wallet_address, e)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                          title="Copy address"
                        >
                          {copiedAddress === wallet.wallet_address ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>

                        {/* Chains Badge */}
                        <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
                          {wallet.chains || 'multi'}
                        </span>

                        {isHighConviction && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                            High Conviction
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Pre-Listing Buys (Sample Size) */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-zinc-800">
                      <div className="inline-flex items-center space-x-1.5">
                        <span>{wallet.total_pre_listing_buys}</span>
                        {isSmallSample && (
                          <span
                            title="Small sample size warning: High statistical variance (n < 3). Do not over-extrapolate."
                            className="inline-flex items-center text-amber-600"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* MEXC Hits */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-zinc-800">
                      {wallet.mexc_hits}
                    </td>

                    {/* Historical Hit Rate */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center space-x-1 font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            wallet.historical_hit_rate >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : wallet.historical_hit_rate >= 50
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {wallet.historical_hit_rate}%
                        </span>
                      </div>
                    </td>

                    {/* Avg Lead Time */}
                    <td className="py-3 px-4 text-right font-mono text-zinc-600">
                      {formatLeadTime(wallet.avg_lead_time)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center text-xs font-medium text-emerald-600 group-hover:underline">
                        History
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer explanation note */}
      <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Click on any wallet row to inspect its token-by-token historical purchase record.</span>
        <span className="font-mono">Ranked by Hit Rate & Sample Size</span>
      </div>
    </div>
  );
};
