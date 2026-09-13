import { historicalMexcAnalyzer } from '../server/historicalMexcAnalyzer.ts';
import fs from 'fs';

async function main() {
  console.log('Starting FULL SCAN historical MEXC analysis on all 41 tokens...');
  const summary = await historicalMexcAnalyzer.runHistoricalAnalysis();

  const validReports = summary.tokenReports.filter(t => t.historicalValidAtT0);
  const mismatchReports = summary.tokenReports.filter(t => t.matchStatus === 'HISTORICAL_MISMATCH');

  // Specific wallet check: 0x545322d21d3e186639a1571aab35833855db1ce2
  const targetWallet = '0x545322d21d3e186639a1571aab35833855db1ce2'.toLowerCase();
  const targetWalletCandidate = summary.topCandidateWallets.find(
    w => w.walletAddress.toLowerCase() === targetWallet
  );

  // Group candidate wallets by uniqueMexcTokens
  const walletsByTokenCount: Record<string, any[]> = {
    '1': [],
    '2': [],
    '3': [],
    '4': [],
    '5+': []
  };

  for (const cw of summary.topCandidateWallets) {
    if (cw.uniqueMexcTokens === 1) walletsByTokenCount['1'].push(cw);
    else if (cw.uniqueMexcTokens === 2) walletsByTokenCount['2'].push(cw);
    else if (cw.uniqueMexcTokens === 3) walletsByTokenCount['3'].push(cw);
    else if (cw.uniqueMexcTokens === 4) walletsByTokenCount['4'].push(cw);
    else if (cw.uniqueMexcTokens >= 5) walletsByTokenCount['5+'].push(cw);
  }

  const multiTokenWallets = summary.topCandidateWallets.filter(w => w.uniqueMexcTokens >= 2);

  const fullScanResults = {
    summary,
    targetWalletAudit: targetWalletCandidate || null,
    walletsByCount: {
      '1': walletsByTokenCount['1'].length,
      '2': walletsByTokenCount['2'].length,
      '3': walletsByTokenCount['3'].length,
      '4': walletsByTokenCount['4'].length,
      '5+': walletsByTokenCount['5+'].length,
    },
    multiTokenWallets: multiTokenWallets.map(w => ({
      wallet: w.walletAddress,
      uniqueMexcTokenCount: w.uniqueMexcTokens,
      tokens: w.tokens,
      totalPreListingBuys: w.totalPreListingBuys,
      hitRate: w.hitRate,
      firstSeen: new Date(w.firstSeen).toISOString(),
      lastSeen: new Date(w.lastSeen).toISOString(),
      sampleDetails: w.sampleDetails
    }))
  };

  fs.writeFileSync('./full_scan_audit_results.json', JSON.stringify(fullScanResults, null, 2));
  console.log('FULL SCAN completed! Results saved to ./full_scan_audit_results.json');
}

main().catch(err => {
  console.error('Full scan audit failed:', err);
  process.exit(1);
});
