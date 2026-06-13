import { dispatch } from './store';
import type { ToastMessage, ToastOptions, Toast } from './types';

let counter = 0;
function genId() {
  return `t_${++counter}`;
}

const DEFAULT_DURATIONS: Record<Toast['type'], number> = {
  blank: 4000,
  success: 2000,
  error: 4000,
  loading: Infinity,
  custom: 4000,
};

function createToast(
  type: Toast['type'],
  message: ToastMessage,
  opts?: ToastOptions
): Toast {
  return {
    id: opts?.id ?? genId(),
    type,
    message,
    duration: opts?.duration ?? DEFAULT_DURATIONS[type],
    visible: true,
    height: undefined,
    pauseDuration: 0,
    createdAt: Date.now(),
    icon: opts?.icon,
    style: opts?.style,
    textStyle: opts?.textStyle,
  };
}

interface ToastFn {
  (message: ToastMessage, opts?: ToastOptions): string;
  success: (message: ToastMessage, opts?: ToastOptions) => string;
  error: (message: ToastMessage, opts?: ToastOptions) => string;
  loading: (message: ToastMessage, opts?: ToastOptions) => string;
  custom: (message: ToastMessage, opts?: ToastOptions) => string;
  dismiss: (toastId?: string) => void;
  remove: (toastId?: string) => void;
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    msgs: {
      loading: ToastMessage;
      success: ToastMessage | ((data: T) => ToastMessage);
      error: ToastMessage | ((err: unknown) => ToastMessage);
    },
    opts?: ToastOptions
  ) => Promise<T>;
}

const toast = ((message: ToastMessage, opts?: ToastOptions): string => {
  const t = createToast('blank', message, opts);
  dispatch({ type: 'UPSERT_TOAST', toast: t });
  return t.id;
}) as ToastFn;

toast.success = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast('success', message, opts);
  dispatch({ type: 'UPSERT_TOAST', toast: t });
  return t.id;
};

toast.error = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast('error', message, opts);
  dispatch({ type: 'UPSERT_TOAST', toast: t });
  return t.id;
};

toast.loading = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast('loading', message, opts);
  dispatch({ type: 'UPSERT_TOAST', toast: t });
  return t.id;
};

toast.custom = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast('custom', message, opts);
  dispatch({ type: 'UPSERT_TOAST', toast: t });
  return t.id;
};

toast.dismiss = (toastId?: string) => {
  dispatch({ type: 'DISMISS_TOAST', toastId });
  setTimeout(() => {
    dispatch({ type: 'REMOVE_TOAST', toastId });
  }, 1000);
};

toast.remove = (toastId?: string) => {
  dispatch({ type: 'REMOVE_TOAST', toastId });
};

toast.promise = async <T>(
  promise: Promise<T> | (() => Promise<T>),
  msgs: {
    loading: ToastMessage;
    success: ToastMessage | ((data: T) => ToastMessage);
    error: ToastMessage | ((err: unknown) => ToastMessage);
  },
  opts?: ToastOptions
): Promise<T> => {
  const id = toast.loading(msgs.loading, opts);
  const p = typeof promise === 'function' ? promise() : promise;
  try {
    const data = await p;
    const successResolver = msgs.success as (data: T) => ToastMessage;
    const msg: ToastMessage =
      typeof msgs.success === 'function' ? successResolver(data) : msgs.success;
    dispatch({
      type: 'UPSERT_TOAST',
      toast: createToast('success', msg, { ...opts, id }),
    });
    return data;
  } catch (err) {
    const errorResolver = msgs.error as (err: unknown) => ToastMessage;
    const msg: ToastMessage =
      typeof msgs.error === 'function' ? errorResolver(err) : msgs.error;
    dispatch({
      type: 'UPSERT_TOAST',
      toast: createToast('error', msg, { ...opts, id }),
    });
    throw err;
  }
};

export default toast;
