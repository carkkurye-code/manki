import React, { useState } from 'react';
import { Layers, RefreshCw, ExternalLink, ShieldCheck, HelpCircle, Download } from 'lucide-react';
import { MexcListing } from '../types';
import { api } from '../api';

interface MexcListingsViewProps {
  listings: MexcListing[];
  loading: boolean;
  onRefresh: () => void;
}

export const MexcListingsView: React.FC<MexcListingsViewProps> = ({ listings, loading, onRefresh }) => {
  const [fetching, setFetching] = useState<boolean>(false);
  const [fetchLimit, setFetchLimit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');

  const handleFetchFresh = async () => {
    setFetching(true);
    try {
      await api.triggerListingCollection(fetchLimit, true);
      onRefresh();
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setFetching(false);
    }
  };

  const filtered = listings.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.symbol.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.token_address.toLowerCase().includes(q) ||
      l.chain.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
              MEXC Past Listings Database
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
              {listings.length} Analyzed
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Official MEXC listings with contract addresses, chains, and exact launch timestamps ($T=0$)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
          />

          <button
            id="btn-fetch-mexc"
            onClick={handleFetchFresh}
            disabled={fetching}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-md transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
            <span>{fetching ? 'Fetching from MEXC...' : 'Fetch MEXC Pairs'}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Token & Symbol</th>
              <th className="py-3 px-4">Chain</th>
              <th className="py-3 px-4">Contract Address</th>
              <th className="py-3 px-4">Listing Timestamp (T=0)</th>
              <th className="py-3 px-4 text-center">Meme Tag</th>
              <th className="py-3 px-4 text-right">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">Loading listings...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500">No listings found.</td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={`${item.chain}-${item.token_address}`} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold font-mono text-zinc-900">${item.symbol}</span>
                      <span className="text-zinc-500 text-[11px] truncate max-w-[140px]">{item.name}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-zinc-100 text-zinc-700 rounded border border-zinc-200">
                      {item.chain}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-zinc-600 text-[11px]">
                    <span title={item.token_address}>
                      {item.token_address.length > 24
                        ? `${item.token_address.slice(0, 10)}...${item.token_address.slice(-8)}`
                        : item.token_address}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-zinc-700">
                    <div>{new Date(item.listing_timestamp).toLocaleString()}</div>
                    <span className="text-[10px] text-zinc-400">T=0 reference benchmark</span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    {item.is_meme === 'yes' ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                        MEME
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-500 rounded border border-zinc-200">
                        unknown
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <a
                        href={`https://dexscreener.com/${item.chain}/${item.token_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-500 hover:text-zinc-800 font-medium inline-flex items-center space-x-0.5"
                      >
                        <span>DEX</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={item.listing_url || `https://www.mexc.com/exchange/${item.symbol}_USDT`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center space-x-0.5"
                      >
                        <span>MEXC</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
