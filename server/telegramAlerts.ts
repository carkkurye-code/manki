import { logger } from './logger.js';
import { dbHelpers } from './db.js';
import { AlertRecord, WalletStats } from './types.js';

export interface SignalCandidate {
  wallet: WalletStats;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  amount?: number;
  txHash?: string;
  buyTimestamp: number;
}

export class TelegramAlertManager {
  private botToken: string;
  private chatId: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  isConfigured(): boolean {
    return !!(this.botToken && this.chatId && this.botToken.trim() !== '' && this.chatId.trim() !== '');
  }

  getCredentialsInfo() {
    return {
      configured: this.isConfigured(),
      hasToken: !!this.botToken,
      hasChatId: !!this.chatId,
      chatIdPreview: this.chatId ? `${this.chatId.slice(0, 3)}***` : 'Not set'
    };
  }

  setCredentials(token: string, chatId: string) {
    this.botToken = token.trim();
    this.chatId = chatId.trim();
    process.env.TELEGRAM_BOT_TOKEN = this.botToken;
    process.env.TELEGRAM_CHAT_ID = this.chatId;
    logger.alert('Telegram credentials updated in runtime.');
  }

  async sendTelegramMessage(text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      logger.alert(`[Telegram Alert Simulation] (Bot not configured) - Notification content:\n${text}`, 'warn');
      return { success: false, error: 'Telegram credentials not configured in .env' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.description || `HTTP ${res.status}`);
      }

      logger.alert(`Telegram alert sent successfully (Msg ID: ${json.result?.message_id}).`, 'success');
      return { success: true, messageId: String(json.result?.message_id) };
    } catch (err: any) {
      logger.alert(`Failed to send Telegram message: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  }

  // Anti-spam check and single wallet alert dispatcher
  async processWalletBuy(candidate: SignalCandidate): Promise<boolean> {
    const { wallet, tokenAddress, tokenSymbol, chain, buyTimestamp, txHash } = candidate;

    // Check anti-spam: has this wallet already alerted for this token on this chain?
    const alreadyAlerted = dbHelpers.hasAlerted(wallet.wallet_address, tokenAddress, chain);
    if (alreadyAlerted) {
      logger.alert(`Anti-Spam Filter: Wallet ${wallet.wallet_address.slice(0, 8)} already alerted for ${tokenSymbol || tokenAddress}. Alert skipped.`);
      return false;
    }

    const shortWallet = `${wallet.wallet_address.slice(0, 6)}...${wallet.wallet_address.slice(-4)}`;
    const msg = [
      `🎯 <b>MEXC SMART WALLET DETECTED</b>`,
      ``,
      `<b>Token:</b> $${tokenSymbol || 'UNKNOWN'}`,
      `<b>Chain:</b> ${chain.toUpperCase()}`,
      `<b>Contract:</b> <code>${tokenAddress}</code>`,
      ``,
      `<b>Wallet:</b> <code>${shortWallet}</code>`,
      `<b>Historical MEXC Hit Rate:</b> ${wallet.historical_hit_rate}%`,
      `<b>Sample Size:</b> ${wallet.total_pre_listing_buys} pre-listing buys`,
      `<b>MEXC Hits:</b> ${wallet.mexc_hits}`,
      `<b>Avg Lead Time:</b> ${(wallet.avg_lead_time / 86400).toFixed(1)} days`,
      ``,
      `<i>This wallet previously purchased tokens before they were listed on MEXC. This is NOT a guarantee of MEXC listing.</i>`
    ].join('\n');

    const result = await this.sendTelegramMessage(msg);

    // Save alert in database
    const alertRecord: AlertRecord = {
      token_address: tokenAddress,
      chain,
      wallet_address: wallet.wallet_address,
      alert_type: 'SINGLE_WALLET',
      message_text: msg,
      created_at: Date.now(),
      telegram_message_id: result.messageId
    };

    dbHelpers.insertAlert(alertRecord);
    return true;
  }

  // Build formatted multi-wallet signal message
  buildMultiWalletMessage(tokenAddress: string, tokenSymbol: string, chain: string, smartWallets: WalletStats[]): string {
    const walletLines = smartWallets.map((w, idx) => {
      const shortAddr = `${w.wallet_address.slice(0, 6)}...${w.wallet_address.slice(-4)}`;
      return [
        `<b>Wallet ${idx + 1} (<code>${shortAddr}</code>)</b>`,
        `Historical MEXC Hit Rate: <b>${w.historical_hit_rate}%</b>`,
        `Sample Size: <b>${w.total_pre_listing_buys}</b>`
      ].join('\n');
    }).join('\n\n');

    return [
      `🚨 <b>MEXC SMART WALLET SIGNAL</b>`,
      ``,
      `<b>Token:</b> $${tokenSymbol || 'UNKNOWN'}`,
      `<b>Chain:</b> ${chain.toUpperCase()}`,
      `<b>Contract:</b> <code>${tokenAddress}</code>`,
      ``,
      `<b>Smart wallets detected: ${smartWallets.length}</b>`,
      ``,
      walletLines,
      ``,
      `This token was purchased by multiple wallets that previously appeared before MEXC listings.`,
      ``,
      `<b>This is NOT a guarantee of MEXC listing.</b>`
    ].join('\n');
  }

  // Section 17: Multi-Wallet Aggregated Signal
  async processMultiWalletSignal(tokenAddress: string, tokenSymbol: string, chain: string, smartWallets: WalletStats[]): Promise<boolean> {
    if (smartWallets.length === 0) return false;

    const msg = this.buildMultiWalletMessage(tokenAddress, tokenSymbol, chain, smartWallets);

    const result = await this.sendTelegramMessage(msg);

    const alertRecord: AlertRecord = {
      token_address: tokenAddress,
      chain,
      wallet_address: smartWallets.map(w => w.wallet_address).join(','),
      alert_type: 'AGGREGATED',
      message_text: msg,
      created_at: Date.now(),
      telegram_message_id: result.messageId
    };

    dbHelpers.insertAlert(alertRecord);
    logger.alert(`Multi-Wallet Aggregated Signal generated for $${tokenSymbol} (${smartWallets.length} smart wallets)!`, 'success');
    return true;
  }
}

export const telegramAlerts = new TelegramAlertManager();
