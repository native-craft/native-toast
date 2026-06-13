import type { ToasterState, Action } from './types';

const TOAST_LIMIT = 3;

type Listener = (state: ToasterState) => void;

let memoryState: ToasterState = { toasts: [], pausedAt: undefined };
const listeners: Listener[] = [];

function reducer(state: ToasterState, action: Action): ToasterState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
    case 'UPSERT_TOAST':
      return state.toasts.find((t) => t.id === action.toast.id)
        ? reducer(state, { type: 'UPDATE_TOAST', toast: action.toast })
        : reducer(state, { type: 'ADD_TOAST', toast: action.toast });
    case 'DISMISS_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || !action.toastId
            ? { ...t, visible: false }
            : t
        ),
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: action.toastId
          ? state.toasts.filter((t) => t.id !== action.toastId)
          : [],
      };
    case 'START_PAUSE':
      return { ...state, pausedAt: action.time };
    case 'END_PAUSE': {
      const elapsed = action.time - (state.pausedAt ?? action.time);
      return {
        ...state,
        pausedAt: undefined,
        toasts: state.toasts.map((t) => ({
          ...t,
          pauseDuration: t.pauseDuration + elapsed,
        })),
      };
    }
  }
}

export function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

export function addListener(listener: Listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export { memoryState };
