import { SystemLog } from './types.js';

class Logger {
  private logs: SystemLog[] = [];
  private maxLogs: number = 500;
  private listeners: ((log: SystemLog) => void)[] = [];

  log(category: SystemLog['category'], message: string, level: SystemLog['level'] = 'info') {
    const logItem: SystemLog = {
      id: Math.random().toString(36).substring(2, 9),
      category,
      message,
      timestamp: Date.now(),
      level
    };

    this.logs.unshift(logItem);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const timeStr = new Date(logItem.timestamp).toISOString().split('T')[1].slice(0, 8);
    console.log(`[${timeStr}] [${category}] ${message}`);

    this.listeners.forEach(fn => {
      try {
        fn(logItem);
      } catch (err) {
        // ignore listener error
      }
    });

    return logItem;
  }

  mexc(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('MEXC', msg, level);
  }

  dex(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('DEX', msg, level);
  }

  wallet(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('WALLET', msg, level);
  }

  analysis(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('ANALYSIS', msg, level);
  }

  alert(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('ALERT', msg, level);
  }

  system(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('SYSTEM', msg, level);
  }

  test(msg: string, level: SystemLog['level'] = 'info') {
    return this.log('TEST', msg, level);
  }

  getRecentLogs(limit = 100): SystemLog[] {
    return this.logs.slice(0, limit);
  }

  subscribe(listener: (log: SystemLog) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();
