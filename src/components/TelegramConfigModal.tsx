import React, { useState } from 'react';
import { X, Send, Key, MessageSquare, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';

interface TelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentConfig?: {
    configured: boolean;
    hasToken: boolean;
    hasChatId: boolean;
    chatIdPreview: string;
  };
}

export const TelegramConfigModal: React.FC<TelegramConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  currentConfig
}) => {
  const [token, setToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.saveTelegramConfig(token, chatId);
      setFeedback({ type: 'success', message: 'Telegram credentials saved successfully!' });
      onSaved();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save Telegram credentials' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await api.testTelegram();
      if (res.success) {
        setFeedback({ type: 'success', message: 'Test message delivered to Telegram chat!' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Telegram test message delivery failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="modal-telegram-config"
        className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-5 border-b border-zinc-200 flex items-start justify-between bg-zinc-50/70">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Telegram Bot Integration
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                currentConfig?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {currentConfig?.configured ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <h3 className="mt-1 text-base font-bold text-zinc-900">
              Configure Telegram Bot Alerts
            </h3>
            <p className="text-xs text-zinc-500">
              Receive instant alerts when smart wallets buy new tokens before MEXC listings
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1">
              Bot Token (from @BotFather)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-telegram-token"
                type="password"
                placeholder={currentConfig?.hasToken ? '••••••••••••••••••••' : '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-400 focus:bg-white font-mono"
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Create a bot via @BotFather on Telegram and copy the API HTTP token.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1">
              Chat ID or Channel Username
            </label>
            <div className="relative">
              <MessageSquare className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-telegram-chatid"
                type="text"
                placeholder={currentConfig?.chatIdPreview || '-1001234567890 or @your_channel'}
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-400 focus:bg-white font-mono"
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              User ID, group ID (with negative sign), or public channel username where alerts should be sent.
            </p>
          </div>

          {feedback && (
            <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              id="btn-test-telegram"
              type="button"
              onClick={handleTest}
              disabled={testing || (!currentConfig?.configured && !token)}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testing ? 'Sending...' : 'Send Test Notification'}</span>
            </button>

            <button
              id="btn-save-telegram"
              type="submit"
              disabled={saving || (!token && !chatId)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors disabled:opacity-50 shadow-xs"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Credentials</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
