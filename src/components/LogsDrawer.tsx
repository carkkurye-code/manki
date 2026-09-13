import React, { useState, useEffect } from 'react';
import { X, Terminal, Trash2, RefreshCw, Filter } from 'lucide-react';
import { SystemLog } from '../types';
import { api } from '../api';

interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogsDrawer: React.FC<LogsDrawerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.category === filter;
  });

  const getBadgeColor = (cat: string) => {
    switch (cat) {
      case 'MEXC': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'DEX': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'WALLET': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'ANALYSIS': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'ALERT': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'TEST': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-zinc-900 text-zinc-100 shadow-2xl flex flex-col border-l border-zinc-800 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-mono font-bold tracking-tight text-white">
            System Live Logs (Structured Stream)
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 text-zinc-400 hover:text-white rounded transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center space-x-1.5 overflow-x-auto text-[11px] font-mono">
        {['ALL', 'MEXC', 'DEX', 'WALLET', 'ANALYSIS', 'ALERT', 'TEST', 'SYSTEM'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-0.5 rounded transition-colors ${
              filter === cat
                ? 'bg-zinc-700 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Logs Window */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-zinc-950">
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-500 py-12 text-center">No logs found for this category.</div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
              <span className="text-zinc-500 shrink-0 text-[10px] mt-0.5">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded border uppercase shrink-0 ${getBadgeColor(log.category)}`}>
                [{log.category}]
              </span>
              <span className={`break-all ${
                log.level === 'error'
                  ? 'text-rose-400'
                  : log.level === 'warn'
                  ? 'text-amber-300'
                  : log.level === 'success'
                  ? 'text-emerald-400'
                  : 'text-zinc-300'
              }`}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>Total buffered: {logs.length} events</span>
        <span>Auto-refreshes every 3s</span>
      </div>
    </div>
  );
};
