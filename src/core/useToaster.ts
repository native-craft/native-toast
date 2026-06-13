import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useToasterStore } from './useToasterStore';
import { dispatch } from './store';

const REMOVE_DELAY = 1000;

export function useToaster() {
  const { toasts, pausedAt } = useToasterStore();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        dispatch({ type: 'START_PAUSE', time: Date.now() });
      } else {
        dispatch({ type: 'END_PAUSE', time: Date.now() });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (pausedAt) return;

    const now = Date.now();
    const timeouts = toasts.map((t) => {
      if (t.duration === Infinity) return undefined;
      if (!t.visible) return undefined;

      const remaining = t.duration - (now - t.createdAt) + t.pauseDuration;

      if (remaining < 0) {
        dispatch({ type: 'DISMISS_TOAST', toastId: t.id });
        return undefined;
      }

      return setTimeout(() => {
        dispatch({ type: 'DISMISS_TOAST', toastId: t.id });
        setTimeout(() => {
          dispatch({ type: 'REMOVE_TOAST', toastId: t.id });
        }, REMOVE_DELAY);
      }, remaining);
    });

    return () => timeouts.forEach((t) => t && clearTimeout(t));
  }, [toasts, pausedAt]);

  const handlers = {
    startPause: () => dispatch({ type: 'START_PAUSE', time: Date.now() }),
    endPause: () => dispatch({ type: 'END_PAUSE', time: Date.now() }),
    updateHeight: (toastId: string, height: number) => {
      dispatch({ type: 'UPDATE_TOAST', toast: { id: toastId, height } });
    },
  };

  return { toasts, handlers };
}
