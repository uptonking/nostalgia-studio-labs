import { type RefObject, useCallback, useMemo, useRef, useState } from 'react';

import { useSlateStatic } from '../../hooks/use-slate-static';

import { AndroidInputManager } from './android-input-manager';
import { useRestoreDom } from './use-restore-dom';
import { useMutationObserver } from './use-mutation-observer';
import { useTrackUserInput } from './use-track-user-input';

const MUTATION_OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
  characterData: true,
  characterDataOldValue: true,
  subtree: true,
};

export function useAndroidInputManager(node: RefObject<HTMLElement>) {
  const editor = useSlateStatic();

  const { receivedUserInput, onUserInput } = useTrackUserInput();
  const restoreDom = useRestoreDom(node, receivedUserInput);

  const inputManager = useMemo(
    () => new AndroidInputManager(editor, restoreDom),
    [restoreDom, editor],
  );

  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReconciling = useRef(false);
  const flush = useCallback((mutations: MutationRecord[]) => {
    if (!receivedUserInput.current) {
      return;
    }

    isReconciling.current = true;
    inputManager.flush(mutations);

    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }

    timeoutId.current = setTimeout(() => {
      isReconciling.current = false;
      timeoutId.current = null;
    }, 250);
  }, []);

  useMutationObserver(node, flush, MUTATION_OBSERVER_CONFIG);

  return {
    isReconciling,
    onUserInput,
  };
}
