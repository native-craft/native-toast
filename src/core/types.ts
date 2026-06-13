import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle, TextStyle } from 'react-native';

export type ToastType = 'blank' | 'success' | 'error' | 'loading' | 'custom';

export type ToastTheme = 'dark' | 'light';

export interface Toast {
  id: string;
  type: ToastType;
  message: ReactNode | ((t: Toast) => ReactNode);
  duration: number;
  visible: boolean;
  height?: number;
  pauseDuration: number;
  createdAt: number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export interface ToastOptions {
  id?: string;
  duration?: number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export interface DefaultToastOptions extends ToastOptions {
  success?: Partial<ToastOptions>;
  error?: Partial<ToastOptions>;
  loading?: Partial<ToastOptions>;
  blank?: Partial<ToastOptions>;
}

export interface ToasterState {
  toasts: Toast[];
  pausedAt: number | undefined;
}

export type ToastMessage = Toast['message'];

export type Action =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'UPDATE_TOAST'; toast: Partial<Toast> & { id: string } }
  | { type: 'UPSERT_TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string }
  | { type: 'START_PAUSE'; time: number }
  | { type: 'END_PAUSE'; time: number };
