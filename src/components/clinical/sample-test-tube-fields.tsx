'use client';

import { useCallback, useRef } from 'react';
import { getTubeForTest, getTubeForTests } from '@/lib/clinical/sample-test-tube-map';

interface UseSampleTubeAutoFillOptions {
  onTubeChange: (tube: string) => void;
}

/** Skips auto-fill on initial load; only maps tube after the user changes test selection. */
export function useSampleTubeAutoFill({ onTubeChange }: UseSampleTubeAutoFillOptions) {
  const skipAutoTubeRef = useRef(true);

  const resetAutoTubeGuard = useCallback(() => {
    skipAutoTubeRef.current = true;
  }, []);

  const applyTubeForTest = useCallback(
    (test: string) => {
      if (skipAutoTubeRef.current) {
        skipAutoTubeRef.current = false;
        return;
      }
      const mappedTube = getTubeForTest(test);
      if (mappedTube) {
        onTubeChange(mappedTube);
      }
    },
    [onTubeChange],
  );

  const applyTubeForTests = useCallback(
    (tests: string[]) => {
      if (skipAutoTubeRef.current) {
        skipAutoTubeRef.current = false;
        return;
      }
      const mappedTube = getTubeForTests(tests);
      if (mappedTube) {
        onTubeChange(mappedTube);
      }
    },
    [onTubeChange],
  );

  return {
    resetAutoTubeGuard,
    applyTubeForTest,
    applyTubeForTests,
  };
}

export { getTubeForTest, getTubeForTests, getTubesForTestsList } from '@/lib/clinical/sample-test-tube-map';
