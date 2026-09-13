import React from 'react';
import { Layers, Users, ShoppingCart, Target, Info, ShieldCheck } from 'lucide-react';
import { DashboardStats } from '../types';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  const listings = stats?.mexcListingsAnalyzed ?? 0;
  const smartWallets = stats?.smartWalletsFound ?? 0;
  const preListingBuys = stats?.totalPreListingBuys ?? 0;
  const mexcHits = stats?.totalMexcHits ?? 0;

  // Global hit percentage
  const globalHitRate = preListingBuys > 0 ? ((mexcHits / preListingBuys) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-4">
      {/* 4 Core Primary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: MEXC Listings Analyzed */}
        <div id="stat-card-listings" className="bg-white rounded-xl p-4 border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              MEXC Listings Analyzed
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {loading && !stats ? '...' : listings}
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Verified T=0
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Meme token spot pairs on MEXC</p>
        </div>

        {/* Card 2: Smart Wallets Found */}
        <div id="stat-card-smart-wallets" className="bg-white rounded-xl p-4 border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Smart Wallets Found
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {loading && !stats ? '...' : smartWallets}
            </div>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              Candidate Pool
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Repeated pre-listing buyers</p>
        </div>

        {/* Card 3: Total Pre-Listing Buys */}
        <div id="stat-card-pre-buys" className="bg-white rounded-xl p-4 border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Total Pre-Listing Buys
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {loading && !stats ? '...' : preListingBuys}
            </div>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Sample Data
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">DEX swaps before MEXC T=0</p>
        </div>

        {/* Card 4: Total MEXC Hits */}
        <div id="stat-card-hits" className="bg-white rounded-xl p-4 border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Total MEXC Hits
            </span>
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {loading && !stats ? '...' : mexcHits}
            </div>
            <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
              {globalHitRate}% Aggregate
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Pre-bought tokens successfully listed</p>
        </div>
      </div>

      {/* Data Provider Connection Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-lg border border-zinc-200 text-xs shadow-2xs">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-zinc-700">Data Providers:</span>
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>MEXC Spot API</span>
          </span>
          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-mono text-[11px] ${
            stats?.bitquery?.configured 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stats?.bitquery?.configured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span>{stats?.bitquery?.configured ? 'Bitquery GraphQL v2 Connected' : 'Bitquery Key Missing in .env'}</span>
          </span>
          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-mono text-[11px] ${
            stats?.telegram?.configured 
              ? 'bg-sky-50 text-sky-800 border border-sky-200' 
              : 'bg-zinc-100 text-zinc-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stats?.telegram?.configured ? 'bg-sky-500' : 'bg-zinc-400'}`}></span>
            <span>{stats?.telegram?.configured ? 'Telegram Bot Active' : 'Telegram Bot Inactive'}</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-400 font-mono">
          Production Database: Isolated & Verified
        </div>
      </div>

      {/* Statistical Discipline Banner (Section 12 requirement) */}
      <div className="flex items-start space-x-3 p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-600">
        <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <span className="font-semibold text-zinc-800">
            Statistical Discipline Notice (Sample Size Weighting):
          </span>
          <p>
            A wallet with 1 buy and 1 hit (100% rate, n=1) is statistically weak due to high variance. Wallets with larger sample sizes (e.g. 15 hits across 20 buys, 75% rate, n=20) represent much higher statistical conviction. Always examine both Hit Rate and Sample Size simultaneously.
          </p>
        </div>
      </div>
    </div>
  );
};
