import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Play, RefreshCw, ShieldCheck, Clock, Check } from 'lucide-react';
import { TestResult } from '../types';
import { api } from '../api';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ isOpen, onClose }) => {
  const [selectedSuite, setSelectedSuite] = useState<'core' | 'historical'>('core');
  const [coreResults, setCoreResults] = useState<TestResult[]>([]);
  const [histResults, setHistResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [hasRunCore, setHasRunCore] = useState<boolean>(false);
  const [hasRunHist, setHasRunHist] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setRunning(true);
    try {
      if (selectedSuite === 'core') {
        const data = await api.runTests();
        setCoreResults(data);
        setHasRunCore(true);
      } else {
        const data = await api.runHistoricalTests();
        setHistResults(data);
        setHasRunHist(true);
      }
    } catch (err: any) {
      console.error('Test execution failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const results = selectedSuite === 'core' ? coreResults : histResults;
  const hasRun = selectedSuite === 'core' ? hasRunCore : hasRunHist;
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="modal-test-suite"
        className="bg-white rounded-2xl max-w-3xl w-full border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-start justify-between bg-zinc-50/70">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Verification Suites
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {selectedSuite === 'core' ? '8 Core Invariant Tests' : '5 Historical MEXC Tests'}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-zinc-900 tracking-tight">
              Tracker Test & Verification Runner
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Automated tests validating RPC pre-listing window, token matching, BUY direction, hit rate math, anti-spam, and signal aggregation
            </p>

            {/* Suite Tabs */}
            <div className="mt-3 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSelectedSuite('core')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedSuite === 'core'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Core Invariant Tests (8/8)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSuite('historical')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedSuite === 'historical'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Historical MEXC-Wallet Tests (5/5)
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Action Bar */}
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
            <div>
              {hasRun ? (
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-bold font-mono ${
                    passedCount === totalCount ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {passedCount} / {totalCount} Tests Passed
                  </span>
                  <span className="text-xs text-zinc-500">
                    ({passedCount === totalCount ? 'All specifications satisfied' : 'Fix regressions'})
                  </span>
                </div>
              ) : (
                <span className="text-xs text-zinc-600 font-medium">
                  Click run to execute all 8 verification test suites against the active database
                </span>
              )}
            </div>

            <button
              id="btn-run-tests-modal"
              onClick={handleRunTests}
              disabled={running}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Tests...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{hasRun ? 'Re-run All Tests' : 'Run Verification Tests'}</span>
                </>
              )}
            </button>
          </div>

          {/* Test Cards List */}
          <div className="space-y-2.5">
            {results.length === 0 && !running && (
              <div className="p-8 text-center text-xs text-zinc-400 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
                Tests have not been executed yet in this view session. Click "Run Verification Tests" to verify the 8 invariants.
              </div>
            )}

            {results.map((test) => (
              <div
                key={test.id}
                className={`p-3.5 rounded-xl border transition-colors ${
                  test.passed
                    ? 'bg-emerald-50/40 border-emerald-200/80'
                    : 'bg-rose-50/40 border-rose-200/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2.5">
                    {test.passed ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    )}

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-zinc-900">
                          {test.id}: {test.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {test.durationMs}ms
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-0.5">{test.description}</p>
                      <div className="mt-1.5 font-mono text-[11px] text-zinc-700 bg-white/80 p-2 rounded border border-zinc-200/60">
                        {test.details}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase font-mono ${
                      test.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Source: <code>server/testRunner.ts</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
