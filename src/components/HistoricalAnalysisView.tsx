import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, Database, Search, ArrowUpRight, ExternalLink } from 'lucide-react';
import { HistoricalAnalysisSummary, HistoricalTokenReport, CandidateWalletScore } from '../types';
import { api } from '../api';

export const HistoricalAnalysisView: React.FC = () => {
  const [summary, setSummary] = useState<HistoricalAnalysisSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async (triggerNew = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = triggerNew
        ? await api.runHistoricalAnalysis()
        : await api.getHistoricalReport();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute historical analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Robinhood Chain &times; MEXC
            </span>
            <span className="text-xs font-mono text-zinc-500">24h Pre-Listing RPC Window</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mt-1">
            Historical Smart Wallet Discovery
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 max-w-2xl">
            Correlates verified MEXC listings against Robinhood Chain on-chain DEX swaps within a 24-hour pre-listing window.
            Identifies early buyers and measures cross-listing repeat rates.
          </p>
        </div>

        <button
          id="btn-run-historical-analysis"
          onClick={() => fetchAnalysis(true)}
          disabled={loading}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors shadow-xs shrink-0 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Scanning Robinhood RPC...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Historical Analysis</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Summary Grid */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Historical MEXC Listings</span>
            <span className="text-lg font-bold text-zinc-900 mt-0.5 block font-mono">
              {summary.historicalMexcListings}
            </span>
            <span className="text-[10px] text-zinc-500">Evaluated</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Robinhood Token Matches</span>
            <span className="text-lg font-bold text-emerald-600 mt-0.5 block font-mono">
              {summary.robinhoodTokenMatches}
            </span>
            <span className="text-[10px] text-zinc-500">Chain ID 4663</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Robinhood Match Rate</span>
            <span className="text-lg font-bold text-indigo-600 mt-0.5 block font-mono">
              {summary.robinhoodMatchRate !== undefined ? `${summary.robinhoodMatchRate}%` : `${((summary.robinhoodTokenMatches / (summary.tokensScanned || 1)) * 100).toFixed(1)}%`}
            </span>
            <span className="text-[10px] text-zinc-500">Of scanned pool</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Tokens Scanned</span>
            <span className="text-lg font-bold text-zinc-900 mt-0.5 block font-mono">
              {summary.tokensScanned}
            </span>
            <span className="text-[10px] text-zinc-500">Historical set</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Real Swap Transactions</span>
            <span className="text-lg font-bold text-zinc-900 mt-0.5 block font-mono">
              {summary.realSwapTransactions}
            </span>
            <span className="text-[10px] text-zinc-500">On-chain RPC</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Real BUYs</span>
            <span className="text-lg font-bold text-blue-600 mt-0.5 block font-mono">
              {summary.realBuys}
            </span>
            <span className="text-[10px] text-zinc-500">Inward transfers</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Unique Wallets</span>
            <span className="text-lg font-bold text-zinc-900 mt-0.5 block font-mono">
              {summary.uniqueWallets}
            </span>
            <span className="text-[10px] text-zinc-500">EOA signers</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Wallets With 3+ MEXC Samples</span>
            <span className="text-lg font-bold text-amber-600 mt-0.5 block font-mono">
              {summary.walletsWith3PlusMexcSamples}
            </span>
            <span className="text-[10px] text-zinc-500">Threshold: &ge;3</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <span className="text-[11px] font-medium text-zinc-400 block">Analysis Status</span>
            <span className={`text-xs font-bold mt-1 block font-mono px-1.5 py-0.5 rounded text-center ${
              summary.analysisStatus === 'PASS'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {summary.analysisStatus}
            </span>
            <span className="text-[9px] text-zinc-500 block text-center mt-0.5">
              {summary.analysisStatus === 'INSUFFICIENT_HISTORICAL_DATA' ? 'Nascent Network' : 'Candidate Verified'}
            </span>
          </div>
        </div>
      )}

      {/* Verification Safeguards & Constraints Box */}
      {summary && (
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-zinc-700">Strict Operational Invariants & Source Integrity:</span>
            </div>
            {summary.mexcCoverage && (
              <span className="text-[11px] text-zinc-500 font-mono hidden md:inline">
                {summary.mexcCoverage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded text-zinc-600 font-mono text-[11px]">
              Fake Data Created: <strong className="text-emerald-700 font-bold">{summary.fakeDataCreated}</strong>
            </span>
            <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded text-zinc-600 font-mono text-[11px]">
              Transactions Sent: <strong className="text-emerald-700 font-bold">{summary.transactionsSent}</strong>
            </span>
            <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded text-zinc-600 font-mono text-[11px]">
              Bitquery: <strong className="text-zinc-800 font-bold">{summary.bitquery}</strong>
            </span>
            <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded text-zinc-600 font-mono text-[11px]">
              GMGN: <strong className="text-zinc-800 font-bold">{summary.gmgn}</strong>
            </span>
            <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded text-zinc-600 font-mono text-[11px]">
              CoinGecko: <strong className="text-zinc-800 font-bold">{summary.coingecko}</strong>
            </span>
            <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded text-zinc-600 font-mono text-[11px]">
              GeckoTerminal: <strong className="text-zinc-800 font-bold">{summary.geckoterminal}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Scanned MEXC Listings Table */}
      {summary && summary.tokenReports && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Scanned Historical MEXC Listings ({summary.tokenReports.length} Listings Evaluated)
              </h3>
              <p className="text-xs text-zinc-500">
                Exact contract address cross-referenced with DEX Screener (Chain ID 4663) and Robinhood RPC pre-listing window
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              {summary.robinhoodTokenMatches} Robinhood Matches
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/30 text-zinc-500 font-medium font-mono text-[11px]">
                  <th className="p-3">Token Symbol</th>
                  <th className="p-3">Contract Address</th>
                  <th className="p-3">MEXC Listing Date</th>
                  <th className="p-3">Match Status</th>
                  <th className="p-3">Pre-Listing RPC Blocks</th>
                  <th className="p-3 text-right">Swaps</th>
                  <th className="p-3 text-right">BUYs</th>
                  <th className="p-3 text-right">SELLs</th>
                  <th className="p-3 text-right">UNKNOWN</th>
                  <th className="p-3 text-right">Unique Wallets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {summary.tokenReports.map((t, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-3 font-bold text-zinc-900 font-mono">
                      ${t.symbol}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-zinc-600">
                      {t.contractAddress ? `${t.contractAddress.slice(0, 8)}...${t.contractAddress.slice(-6)}` : 'NO_CONTRACT'}
                    </td>
                    <td className="p-3 text-zinc-600 font-mono text-[11px]">
                      {new Date(t.mexcListingTimestamp).toISOString().replace('.000Z', 'Z')}
                    </td>
                    <td className="p-3">
                      {t.matchStatus === 'MATCHED_ROBINHOOD' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                          MATCHED_ROBINHOOD
                        </span>
                      ) : t.matchStatus === 'AMBIGUOUS_MATCH' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-mono">
                          AMBIGUOUS_MATCH
                        </span>
                      ) : t.matchStatus === 'NO_CONTRACT_DATA' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-mono">
                          NO_CONTRACT_DATA
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 font-mono">
                          NO_ROBINHOOD_PAIR
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-zinc-500">
                      {t.preListingBlocksRange || 'N/A'}
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-zinc-700">
                      {t.realSwapsFound}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {t.realBuysFound}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-500">
                      {t.realSellsFound}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-400">
                      {t.realUnknownsFound}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-zinc-900">
                      {t.uniqueWalletsFound}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discovered Early Wallets */}
      {summary && summary.topCandidateWallets && summary.topCandidateWallets.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Top Candidate Wallets &amp; Pre-Listing Buyers
              </h3>
              <p className="text-xs text-zinc-500">
                Addresses detected purchasing tokens within T0-24h window before official MEXC listing
              </p>
            </div>
            <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-medium font-mono">
              Candidate Threshold: &ge; 3 Distinct Tokens
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/30 text-zinc-500 font-medium font-mono text-[11px]">
                  <th className="p-3">Wallet Address</th>
                  <th className="p-3">Tokens Traded</th>
                  <th className="p-3 text-right">Pre-Listing Buys</th>
                  <th className="p-3 text-right">Unique MEXC Tokens</th>
                  <th className="p-3 text-right">Successful Listings</th>
                  <th className="p-3 text-right">Hit Rate</th>
                  <th className="p-3">First Seen</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {summary.topCandidateWallets.map((w, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-zinc-900">
                      {w.walletAddress}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-indigo-700">
                      {w.tokens && w.tokens.length > 0 ? w.tokens.map(t => `$${t}`).join(', ') : 'N/A'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-zinc-800">
                      {w.totalPreListingBuys}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-800 font-bold">
                      {w.uniqueMexcTokens}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-800">
                      {w.successfulMexcListings}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-600">
                      {w.hitRate.toFixed(1)}%
                    </td>
                    <td className="p-3 font-mono text-[11px] text-zinc-500">
                      {new Date(w.firstSeen).toISOString()}
                    </td>
                    <td className="p-3">
                      {w.status === 'candidate_smart_wallet' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          candidate_smart_wallet
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          insufficient_sample
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
