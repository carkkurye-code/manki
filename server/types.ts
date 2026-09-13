export interface MexcListing {
  id?: number;
  token_address: string;
  symbol: string;
  name: string;
  chain: string;
  listing_timestamp: number; // in ms
  listing_url?: string;
  is_meme: 'yes' | 'no' | 'unknown';
  created_at: number;
}

export interface DexTrade {
  id?: number;
  tx_hash: string;
  chain: string;
  dex: string;
  token_address: string;
  wallet_address: string;
  timestamp: number; // in ms
  side: 'BUY' | 'SELL' | 'UNKNOWN';
  amount: number;
  input_token: string;
  output_token: string;
}

export interface WalletTokenActivity {
  id?: number;
  wallet_address: string;
  token_address: string;
  chain: string;
  first_buy_timestamp: number;
  last_buy_timestamp: number;
  buy_count: number;
  first_seen_before_listing: number; // 1 or 0
  seconds_before_listing: number;
}

export interface WalletStats {
  wallet_address: string;
  total_pre_listing_buys: number;
  mexc_hits: number;
  non_mexc_buys: number;
  historical_hit_rate: number;
  avg_lead_time: number; // in seconds
  median_lead_time: number; // in seconds
  chains: string;
  first_seen: number;
  last_seen: number;
  updated_at: number;
}

export interface AlertRecord {
  id?: number;
  token_address: string;
  chain: string;
  wallet_address: string;
  alert_type: 'SINGLE_WALLET' | 'AGGREGATED';
  message_text: string;
  created_at: number;
  telegram_message_id?: string;
}

export interface SystemLog {
  id: string;
  category: 'MEXC' | 'DEX' | 'WALLET' | 'ANALYSIS' | 'ALERT' | 'SYSTEM' | 'TEST';
  message: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface TestResult {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

export interface HistoricalTokenReport {
  symbol: string;
  contractAddress: string;
  mexcListingTimestamp: number;
  mexcListingDate: string;
  mexcFound: boolean;
  robinhoodPairMatched: boolean;
  pairAddress?: string;
  dexId?: string;
  liquidityUsd?: number;
  pairCreatedAt?: number;
  pairCreatedDate?: string;
  matchStatus: 'MATCHED_ROBINHOOD' | 'NO_ROBINHOOD_PAIR' | 'AMBIGUOUS_MATCH' | 'NO_CONTRACT_DATA' | 'HISTORICAL_MISMATCH';
  historicalValidAtT0?: boolean;
  preListingRpcScanned: boolean;
  preListingBlocksRange?: string;
  requestedWindowHours?: number;
  actualCoveredWindowHours?: number;
  rpcWindowStatus?: 'RPC_WINDOW_COMPLETE' | 'RPC_WINDOW_INCOMPLETE';
  realSwapsFound: number;
  realBuysFound: number;
  realSellsFound: number;
  realUnknownsFound: number;
  uniqueWalletsFound: number;
}

export type WalletCandidateTier =
  | 'insufficient_sample'
  | 'candidate_smart_wallet'
  | 'strong_candidate'
  | 'high_confidence_candidate';

export interface WalletSampleDetail {
  token: string;
  type: 'pre-listing BUY';
  timestamp: number;
  date: string;
  txHash?: string;
  blockNumber?: number;
}

export interface CandidateWalletScore {
  walletAddress: string;
  totalPreListingBuys: number;
  uniqueMexcTokens: number;
  successfulMexcListings: number;
  hitRate: number;
  firstSeen: number;
  lastSeen: number;
  tokens?: string[];
  sampleDetails?: WalletSampleDetail[];
  status: WalletCandidateTier;
  sampleStatus?: WalletCandidateTier;
}

export interface HistoricalAnalysisSummary {
  historicalMexcListings: number;
  robinhoodTokenMatches: number;
  historicallyValidRobinhoodMatches: number;
  historicalMismatches: number;
  robinhoodMatchRate: number;
  tokensScanned: number;
  completeRpcWindows: number;
  incompleteRpcWindows: number;
  preListingWindow: '24h';
  realSwapTransactions: number;
  realBuys: number;
  realSells: number;
  realUnknowns: number;
  uniqueWallets: number;
  walletsWith2PlusMexcSamples: number;
  walletsWith3PlusMexcSamples: number;
  walletsWith5PlusMexcSamples: number;
  candidateSmartWallets: number;
  strongCandidates: number;
  highConfidenceCandidates: number;
  duplicateTransactionsRemoved: number;
  ambiguousSwapsExcluded: number;
  postListingBuysExcluded: number;
  contractAddressesExcluded: number;
  invalidNonEoaExcluded: number;
  buyFalsePositivesRemoved: number;
  historicalMismatchesRemoved: number;
  topCandidateWallets: CandidateWalletScore[];
  fakeDataCreated: 'NO';
  transactionsSent: 'NO';
  bitquery: 'NOT USED';
  gmgn: 'NOT USED';
  coingecko: 'NOT USED';
  geckoterminal: 'NOT USED';
  analysisStatus: 'PASS' | 'INSUFFICIENT_HISTORICAL_DATA' | 'FAIL';
  tokenReports: HistoricalTokenReport[];
  mexcCoverage?: string;
  dexScreenerCoverage?: string;
  rpcScanStatus?: string;
  windowAuditNote?: string;
}
