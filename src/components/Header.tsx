import React from 'react';
import { Activity, Play, Square, CheckCircle, ShieldAlert, Send, Terminal, RefreshCw } from 'lucide-react';
import { DashboardStats } from '../types';

interface HeaderProps {
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
  onRunPipeline: () => void;
  onToggleMonitor: () => void;
  onOpenTests: () => void;
  onOpenTelegram: () => void;
  onOpenLogs: () => void;
  pipelineRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  loading,
  onRefresh,
  onRunPipeline,
  onToggleMonitor,
  onOpenTests,
  onOpenTelegram,
  onOpenLogs,
  pipelineRunning
}) => {
  const isMonitorActive = stats?.liveMonitor?.active;
  const isTelegramConfigured = stats?.telegram?.configured;

  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Subtitle */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs font-semibold text-lg">
              M
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">
                  MEXC Smart Wallet Tracker
                </h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 rounded-md border border-zinc-200">
                  V1 Research
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Statistical analysis of repetitive pre-listing wallet patterns
              </p>
            </div>
          </div>

          {/* Status Indicators & Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live Monitor Pill */}
            <button
              id="btn-toggle-monitor"
              onClick={onToggleMonitor}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                isMonitorActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
              }`}
              title="Toggle Live DEX Smart Wallet Monitoring"
            >
              {isMonitorActive ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Monitor Active</span>
                </>
              ) : (
                <>
                  <Square className="w-3 h-3 text-zinc-400" />
                  <span>Monitor Idle</span>
                </>
              )}
            </button>

            {/* Telegram Status Button */}
            <button
              id="btn-telegram-settings"
              onClick={onOpenTelegram}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                isTelegramConfigured
                  ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                  : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isTelegramConfigured ? 'Telegram Bot Connected' : 'Configure Telegram'}
              </span>
            </button>

            {/* Test Runner Suite Button */}
            <button
              id="btn-open-tests"
              onClick={onOpenTests}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Verification Tests (8/8)</span>
            </button>

            {/* Logs Button */}
            <button
              id="btn-open-logs"
              onClick={onOpenLogs}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors"
              title="System Logs"
            >
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {/* Refresh */}
            <button
              id="btn-refresh-stats"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Run Full Pipeline */}
            <button
              id="btn-run-pipeline"
              onClick={onRunPipeline}
              disabled={pipelineRunning}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shadow-xs disabled:opacity-50"
            >
              {pipelineRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Run Full Analysis</span>
                  <span className="sm:hidden">Analyze</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
