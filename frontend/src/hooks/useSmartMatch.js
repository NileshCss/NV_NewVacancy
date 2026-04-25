import { useState, useCallback } from 'react';
import { analyzeResume } from '../api/smartmatch.api';

const STEPS = [
  { pct: 10,  label: '📄 Reading your resume...'          },
  { pct: 25,  label: '🔍 Parsing resume structure...'     },
  { pct: 45,  label: '🎯 Calculating ATS score...'        },
  { pct: 60,  label: '💼 Matching with job listings...'   },
  { pct: 75,  label: '🛠 Analyzing skill gaps...'         },
  { pct: 88,  label: '💡 Generating recommendations...'   },
  { pct: 95,  label: '✍️ Writing improvements...'         },
  { pct: 100, label: '✅ Analysis complete!'              },
];

/**
 * SmartMatch™ React hook
 * Manages the full analysis lifecycle
 */
export function useSmartMatch() {
  const [step,       setStep]     = useState('idle');
  const [progress,   setProgress] = useState(0);
  const [stepLabel,  setStepLabel]= useState('');
  const [result,     setResult]   = useState(null);
  const [error,      setError]    = useState(null);
  const [activeTab,  setActiveTab]= useState('summary');

  /**
   * Animate progress through steps
   */
  const animateProgress = useCallback(() => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= STEPS.length) {
        clearInterval(interval);
        return;
      }
      const s = STEPS[idx];
      setProgress(s.pct);
      setStepLabel(s.label);
      idx++;
    }, 800);
    return () => clearInterval(interval);
  }, []);

  /**
   * Run analysis
   * @param {File}   file
   * @param {string} jobDesc
   * @param {string} mode
   */
  const analyze = useCallback(async (file, jobDesc = '', mode = 'full') => {
    setStep('analyzing');
    setProgress(0);
    setError(null);
    setResult(null);
    setActiveTab('summary');

    const stopAnimation = animateProgress();

    try {
      const data = await analyzeResume(file, jobDesc, mode);
      stopAnimation();
      setProgress(100);
      setStepLabel('✅ Analysis complete!');

      if (!data) {
        throw new Error('No data returned from analysis.');
      }

      await new Promise(r => setTimeout(r, 500));
      setResult(data);
      setStep('results');

    } catch (err) {
      stopAnimation();
      console.error('[useSmartMatch] Analysis error:', err);
      const msg = err?.message || String(err) || 'Analysis failed.';
      setError(
        msg.includes('timeout') || msg.includes('Timeout')
          ? 'Analysis is taking longer than expected. Please try again.'
          : msg
      );
      setStep('error');
    }
  }, [animateProgress]);

  /**
   * Reset to upload state
   */
  const reset = useCallback(() => {
    setStep('idle');
    setProgress(0);
    setStepLabel('');
    setResult(null);
    setError(null);
    setActiveTab('summary');
  }, []);

  return {
    step, progress, stepLabel,
    result, error, activeTab,
    setActiveTab, analyze, reset,
  };
}
