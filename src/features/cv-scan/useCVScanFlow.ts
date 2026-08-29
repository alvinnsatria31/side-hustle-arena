'use client';

import { useCallback, useState } from 'react';

export interface UploadedFile {
  name: string;
  size: number; // in bytes
  pages: number;
}

export type CVStage = 'idle' | 'processing' | 'done';

export function useCVScanFlow() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [stage, setStage] = useState<CVStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const setMockFile = useCallback((f: UploadedFile) => {
    setFile(f);
    setError(null);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setStage('idle');
    setError(null);
  }, []);

  const startAnalysis = useCallback(() => {
    if (!file) {
      setError('Unggah CV terlebih dahulu.');
      return false;
    }
    setStage('processing');
    setError(null);
    return true;
  }, [file]);

  const finishAnalysis = useCallback(() => {
    setStage('done');
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setJobDescription('');
    setStage('idle');
    setError(null);
  }, []);

  return {
    file,
    setMockFile,
    clearFile,
    jobDescription,
    setJobDescription,
    stage,
    error,
    startAnalysis,
    finishAnalysis,
    reset,
  };
}
