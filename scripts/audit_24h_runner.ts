import { historicalMexcAnalyzer } from '../server/historicalMexcAnalyzer.ts';
import fs from 'fs';

async function main() {
  console.log('Running 24h audit analysis on all 41 tokens...');
  const summary = await historicalMexcAnalyzer.runHistoricalAnalysis();
  
  // Format detailed audit data
  const validReports = summary.tokenReports.filter(t => t.historicalValidAtT0);
  const mismatchReports = summary.tokenReports.filter(t => t.matchStatus === 'HISTORICAL_MISMATCH');

  // Wallets data
  const allWallets = new Set<string>();
  const buyWallets = new Set<string>();
  const sellWallets = new Set<string>();
  const unknownWallets = new Set<string>();

  // Extract all buys from candidate scores or token reports
  const allBuysList: any[] = [];
  
  const tokenListAudit = validReports.map((t, idx) => ({
    index: idx + 1,
    symbol: t.symbol,
    contract: t.contractAddress,
    mexcT0: new Date(t.mexcListingTimestamp).toISOString(),
    windowStart: t.windowStart,
    windowEnd: t.windowEnd,
    startBlock: t.startBlock,
    endBlock: t.endBlock,
    chunkCount: t.chunkCount,
    successfulChunks: t.chunkCount - (t.failedChunks?.length || 0),
    failedChunks: t.failedChunks?.length || 0,
    actualCoveredHours: t.actualCoveredWindowHours,
    windowComplete: t.windowComplete,
    historicalValid: t.historicalValidAtT0,
    rpcStatus: t.rpcWindowStatus,
    swaps: t.realSwapsFound,
    buys: t.realBuysFound,
    sells: t.realSellsFound,
    unknowns: t.realUnknownsFound,
    uniqueWallets: t.uniqueWalletsFound
  }));

  const auditOutput = {
    summary: {
      historicalMexcListings: summary.historicalMexcListings,
      historicalValidTokens: validReports.length,
      complete24h: summary.complete24hWindows,
      incomplete24h: summary.incomplete24hWindows,
      realSwapTransactions: summary.realSwapTransactions,
      realBuys: summary.realBuys,
      realSells: summary.realSells,
      realUnknowns: summary.realUnknowns,
      uniqueEoaWallets: summary.uniqueEoaWallets,
      wallets1Token: summary.wallets1Token,
      wallets2Tokens: summary.wallets2Tokens,
      wallets3PlusTokens: summary.wallets3PlusTokens,
      candidateSmartWallets: summary.candidateSmartWallets,
      strongCandidates: summary.strongCandidates,
      highConfidenceCandidates: summary.highConfidenceCandidates,
      postListingBuysExcluded: summary.postListingBuysExcluded || 0,
      historicalMismatches: summary.historicalMismatches || 0,
      duplicateTransactionsRemoved: summary.duplicateTransactionsRemoved || 0,
      analysisStatus: summary.analysisStatus
    },
    tokens: tokenListAudit,
    mismatches: mismatchReports.map(m => ({
      symbol: m.symbol,
      contract: m.contractAddress,
      matchStatus: m.matchStatus,
      historicalValid: m.historicalValidAtT0
    }))
  };

  fs.writeFileSync('./audit_results.json', JSON.stringify(auditOutput, null, 2));
  console.log('Audit completed successfully! Saved to ./audit_results.json');
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
