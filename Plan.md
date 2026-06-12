# expo-toast — React Native Toast Library Plan

> Agent instructions. Read this fully before writing a single line of code.
> Every section is a constraint, not a suggestion.

---

## 1. What We're Building

A zero-dependency, headless-first toast notification system for React Native (Expo).
Inspired by `react-hot-toast` — same clean imperative API (`toast()`, `toast.success()`, `toast.error()`, `toast.promise()`), same observable state store pattern — rebuilt from scratch for React Native using `Animated` API and `StyleSheet`.

**Not a port.** A native reimagining. No DOM, no CSS, no `react-hot-toast/headless` import.
We own the full stack: store → hook → renderer → UI.

---

## 2. Core Architecture — How react-hot-toast Works (Study This)

react-hot-toast's genius is its **observer pattern with module-level state**. Here's the exact mental model:

```
toast('hello')          ← imperative call, works outside React
    ↓
dispatch(action)        ← updates memoryState (module-level, NOT React state)
    ↓
listeners.forEach()     ← notifies all subscribed useToasterStore hooks
    ↓
useState setter fires   ← React re-renders only the <Toaster />
    ↓
toasts[] mapped → UI    ← each toast rendered with offset + visibility
```

Key insight: **The store lives outside React.** `toast()` is a plain function. React only plugs in via `useToasterStore` which subscribes/unsubscribes a listener on mount/unmount.

### State Shape (per toaster instance)

```ts
interface ToasterState {
  toasts: Toast[];
  pausedAt: number | undefined;
}

interface Toast {
  id: string;
  type: "blank" | "success" | "error" | "loading" | "custom";
  message: string | ((t: Toast) => React.ReactNode);
  duration: number;
  visible: boolean; // controls animation, NOT mount/unmount
  height?: number; // measured after render, used for stacking offset
  pauseDuration: number; // accumulates paused time so timer stays accurate
  createdAt: number;
}
```

### Reducer Actions

```
ADD_TOAST       → prepend to toasts[], enforce TOAST_LIMIT (default: 1 visible at a time)
UPDATE_TOAST    → merge partial fields onto existing toast by id
DISMISS_TOAST   → set visible: false (triggers exit animation, not removal)
REMOVE_TOAST    → splice from array (called after removeDelay ms)
START_PAUSE     → record timestamp
END_PAUSE       → add elapsed to each toast's pauseDuration
UPSERT_TOAST    → ADD_TOAST if id doesn't exist, UPDATE_TOAST if it does
```

### Timer Logic

Each toast auto-dismisses. The timer is managed inside `useToaster`:

```
useEffect runs for each toast where:
  - toast.duration !== Infinity
  - !pausedAt
  - toast.visible

Sets a setTimeout of: toast.duration - (Date.now() - toast.createdAt) - toast.pauseDuration
On fire: dispatch DISMISS_TOAST → then dispatch REMOVE_TOAST after removeDelay
```

---

## 3. File Structure

```
src/
  core/
    types.ts          ← all TypeScript interfaces/types
    store.ts          ← module-level state, reducer, dispatch, listeners
    toast.ts          ← toast() function and all variants
    useToasterStore.ts ← subscribes React component to store
    useToaster.ts     ← adds timer management + pause handlers on top of store
  components/
    ToastContainer.tsx ← the <ToastContainer /> component (place once in app root)
    ToastItem.tsx      ← single toast visual, handles Animated enter/exit
    ToastIcon.tsx      ← success/error/loading/blank icon switcher
  index.ts            ← public exports
```

---

## 4. Implementation Spec — File by File

### 4.1 `core/types.ts`

```ts
export type ToastType = "blank" | "success" | "error" | "loading" | "custom";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Toast {
  id: string;
  type: ToastType;
  message: string | React.ReactNode | ((t: Toast) => React.ReactNode);
  duration: number;
  visible: boolean;
  height?: number;
  pauseDuration: number;
  createdAt: number;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  textStyle?: import("react-native").StyleProp<
    import("react-native").TextStyle
  >;
}

export interface ToastOptions {
  id?: string;
  duration?: number;
  position?: ToastPosition;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  textStyle?: import("react-native").StyleProp<
    import("react-native").TextStyle
  >;
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

export type ToastMessage = Toast["message"];
```

---

### 4.2 `core/store.ts`

```ts
// Module-level state — lives OUTSIDE React
const TOAST_LIMIT = 3;
const DEFAULT_REMOVE_DELAY = 1000;

type Listener = (state: ToasterState) => void;

let memoryState: ToasterState = { toasts: [], pausedAt: undefined };
const listeners: Listener[] = [];

function reducer(state: ToasterState, action: Action): ToasterState {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };
    case "UPSERT_TOAST":
      return state.toasts.find((t) => t.id === action.toast.id)
        ? reducer(state, { type: "UPDATE_TOAST", toast: action.toast })
        : reducer(state, { type: "ADD_TOAST", toast: action.toast });
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || !action.toastId
            ? { ...t, visible: false }
            : t,
        ),
      };
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: action.toastId
          ? state.toasts.filter((t) => t.id !== action.toastId)
          : [],
      };
    case "START_PAUSE":
      return { ...state, pausedAt: action.time };
    case "END_PAUSE": {
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
```

---

### 4.3 `core/toast.ts`

```ts
import { dispatch } from "./store";
import type { ToastMessage, ToastOptions, Toast } from "./types";

let counter = 0;
function genId() {
  return `t_${++counter}`;
}

const DEFAULT_DURATIONS: Record<Toast["type"], number> = {
  blank: 4000,
  success: 2000,
  error: 4000,
  loading: Infinity,
  custom: 4000,
};

function createToast(
  type: Toast["type"],
  message: ToastMessage,
  opts?: ToastOptions,
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
    style: opts?.style,
    textStyle: opts?.textStyle,
  };
}

function toast(message: ToastMessage, opts?: ToastOptions): string {
  const t = createToast("blank", message, opts);
  dispatch({ type: "UPSERT_TOAST", toast: t });
  return t.id;
}

toast.success = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast("success", message, opts);
  dispatch({ type: "UPSERT_TOAST", toast: t });
  return t.id;
};

toast.error = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast("error", message, opts);
  dispatch({ type: "UPSERT_TOAST", toast: t });
  return t.id;
};

toast.loading = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast("loading", message, opts);
  dispatch({ type: "UPSERT_TOAST", toast: t });
  return t.id;
};

toast.custom = (message: ToastMessage, opts?: ToastOptions) => {
  const t = createToast("custom", message, opts);
  dispatch({ type: "UPSERT_TOAST", toast: t });
  return t.id;
};

toast.dismiss = (toastId?: string) => {
  dispatch({ type: "DISMISS_TOAST", toastId });
  setTimeout(() => {
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, 1000);
};

toast.remove = (toastId?: string) => {
  dispatch({ type: "REMOVE_TOAST", toastId });
};

toast.promise = async <T>(
  promise: Promise<T> | (() => Promise<T>),
  msgs: {
    loading: ToastMessage;
    success: ToastMessage | ((data: T) => ToastMessage);
    error: ToastMessage | ((err: unknown) => ToastMessage);
  },
  opts?: ToastOptions,
): Promise<T> => {
  const id = toast.loading(msgs.loading, opts);
  const p = typeof promise === "function" ? promise() : promise;
  try {
    const data = await p;
    const msg =
      typeof msgs.success === "function" ? msgs.success(data) : msgs.success;
    dispatch({
      type: "UPSERT_TOAST",
      toast: createToast("success", msg, { ...opts, id }),
    });
    return data;
  } catch (err) {
    const msg = typeof msgs.error === "function" ? msgs.error(err) : msgs.error;
    dispatch({
      type: "UPSERT_TOAST",
      toast: createToast("error", msg, { ...opts, id }),
    });
    throw err;
  }
};

export default toast;
```

---

### 4.4 `core/useToasterStore.ts`

```ts
import { useEffect, useRef, useState } from "react";
import { addListener, memoryState } from "./store";
import type { ToasterState } from "./types";

export function useToasterStore(): ToasterState {
  const [state, setState] = useState<ToasterState>(memoryState);
  // Keep ref to avoid stale closure in listener
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Sync immediately in case state changed before mount
    setState(memoryState);
    return addListener(setState);
  }, []);

  return state;
}
```

---

### 4.5 `core/useToaster.ts`

```ts
// Adds timer management + pause control on top of useToasterStore
import { useEffect } from "react";
import { useToasterStore } from "./useToasterStore";
import { dispatch } from "./store";

const REMOVE_DELAY = 1000;

export function useToaster() {
  const { toasts, pausedAt } = useToasterStore();

  useEffect(() => {
    if (pausedAt) return;

    const now = Date.now();
    const timeouts = toasts.map((t) => {
      if (t.duration === Infinity) return undefined;
      if (!t.visible) return undefined;

      const remaining = t.duration - (now - t.createdAt) + t.pauseDuration;

      if (remaining < 0) {
        // Already expired — dismiss immediately
        if (t.visible) dispatch({ type: "DISMISS_TOAST", toastId: t.id });
        return undefined;
      }

      return setTimeout(() => {
        dispatch({ type: "DISMISS_TOAST", toastId: t.id });
        setTimeout(() => {
          dispatch({ type: "REMOVE_TOAST", toastId: t.id });
        }, REMOVE_DELAY);
      }, remaining);
    });

    return () => timeouts.forEach((t) => t && clearTimeout(t));
  }, [toasts, pausedAt]);

  const handlers = {
    startPause: () => dispatch({ type: "START_PAUSE", time: Date.now() }),
    endPause: () => dispatch({ type: "END_PAUSE", time: Date.now() }),
    updateHeight: (toastId: string, height: number) => {
      dispatch({ type: "UPDATE_TOAST", toast: { id: toastId, height } as any });
    },
  };

  return { toasts, handlers };
}
```

---

### 4.6 `components/ToastItem.tsx`

This is the most critical component. Follow these rules exactly:

**Animation system:**

- Each `ToastItem` receives a `toast` object and its `index` in visible stack.
- Use `useRef(new Animated.Value(0))` for opacity.
- Use `useRef(new Animated.Value(20))` for translateY.
- On `toast.visible === true`: run `Animated.parallel([fadeIn, slideIn])` with spring.
- On `toast.visible === false`: run `Animated.parallel([fadeOut, slideOut])` then call `toast.remove(id)` after.
- `useEffect` watches `toast.visible`. On change, fire the right animation.

**Layout:**

- Absolute positioned via `StyleSheet` — NO `position: 'absolute'` inline.
- `bottom` or `top` offset calculated from index and height of toasts below/above.
- Use `onLayout` to measure height and call `handlers.updateHeight(id, height)`.

**Visual design (see Section 5):**

- Background: dark surface `#1C1C1E` (iOS system dark) or `#FFFFFF` for light.
- Border radius: `12`.
- Padding: `12px vertical, 16px horizontal`.
- Shadow: `elevation: 8` on Android, `shadowColor + shadowOpacity` on iOS.
- No border. No gradient. Just clean depth.

**Icon layout:**

- Row: `[Icon] [message text]` with `gap: 10`.
- Icon is 20×20. Text is `fontSize: 14, lineHeight: 20`.

---

### 4.7 `components/ToastIcon.tsx`

Map `toast.type` to icon:

| type      | icon                            | color                 |
| --------- | ------------------------------- | --------------------- |
| `success` | `✓` (checkmark in circle)       | `#30D158` (iOS green) |
| `error`   | `✕` (cross in circle)           | `#FF453A` (iOS red)   |
| `loading` | `<ActivityIndicator />`         | `#636366`             |
| `blank`   | nothing                         | —                     |
| `custom`  | nothing (user provides content) | —                     |

Draw icons with SVG via `react-native-svg` OR with pure `View` + `Text` styled shapes — check if `react-native-svg` is in the Expo project. If not, use styled `View` + `Text`. Do NOT add new dependencies.

---

### 4.8 `components/ToastContainer.tsx`

```tsx
// Place once at root of app, after navigation stack
// Usage: <ToastContainer />  (no props required, works out of box)
//        <ToastContainer position="bottom-center" />

import React from "react";
import { View, StyleSheet } from "react-native";
import { useToaster } from "../core/useToaster";
import { ToastItem } from "./ToastItem";

interface ToastContainerProps {
  position?: ToastPosition;
  topOffset?: number; // default: 50 (safe area)
  bottomOffset?: number; // default: 40
  gutter?: number; // gap between stacked toasts, default: 8
}
```

Render all `toasts` (including `visible: false` ones for exit animation).
Toasts stack from the configured edge. Use `calculateOffset` (straight port from react-hot-toast):

```ts
function calculateOffset(
  toasts: Toast[],
  currentToast: Toast,
  gutter: number,
): number {
  const visibleToasts = toasts.filter(
    (t) => t.visible || t.id === currentToast.id,
  );
  const index = visibleToasts.findIndex((t) => t.id === currentToast.id);
  return visibleToasts
    .slice(0, index)
    .reduce((acc, t) => acc + (t.height ?? 48) + gutter, 0);
}
```

`ToastContainer` itself is wrapped in a `StyleSheet.absoluteFill` `PointerEvents="box-none"` View so it overlays the entire app without blocking touches.

---

### 4.9 `index.ts`

```ts
export { default as toast } from "./core/toast";
export { useToaster } from "./core/useToaster";
export { useToasterStore } from "./core/useToasterStore";
export { ToastContainer } from "./components/ToastContainer";
export type {
  Toast,
  ToastOptions,
  ToastType,
  ToastPosition,
} from "./core/types";
```

---

## 5. Design Philosophy & Visual Spec

### Philosophy

**One rule: feel native.** No web-ported shadows. No CSS box-model thinking.
A toast on iOS should look like it belongs to iOS. On Android, same.

**Minimal chrome.** The message is the content. No title + body hierarchy. No close button unless custom. No progress bar.

**Invisible when idle.** The system must be completely silent between notifications. No persistent UI element.

**Stack discipline.** Maximum 3 toasts visible. Oldest auto-dismissed. No cascade of 10 error messages.

### Token System

```
Colors:
  surface-dark:    #1C1C1E   (iOS grouped background secondary)
  surface-light:   #FFFFFF
  text-primary:    #FFFFFF   on dark / #000000 on light
  text-secondary:  #EBEBF5   at 60% opacity (iOS label secondary)
  success:         #30D158   (iOS green)
  error:           #FF453A   (iOS red)
  neutral:         #636366   (iOS separator)
  overlay:         transparent (NO backdrop)

Typography:
  message: SF Pro Text 14 / system font, weight 500, lineHeight 20
  No custom fonts — use 'System' font

Spacing:
  toast padding:   12 vertical, 16 horizontal
  icon gap:        10
  gutter between:  8
  edge offset top: 50 (below status bar)
  edge offset bot: 40 (above home indicator)

Shape:
  borderRadius: 12
  No border

Elevation (Android):
  elevation: 8

Shadow (iOS):
  shadowColor: #000
  shadowOffset: { width: 0, height: 4 }
  shadowOpacity: 0.15
  shadowRadius: 12

Animation:
  Enter: spring — tension 100, friction 12
         opacity: 0→1 (200ms ease-out)
         translateY: ±20→0 (spring)
  Exit:  timing — 150ms ease-in
         opacity: 1→0
         translateY: 0→±10
```

### The Signature Element

The single memorable thing: **toasts slide in from the edge they originate from, not from center.** Top toasts enter from above (translateY: -20 → 0). Bottom toasts enter from below (translateY: 20 → 0). This feels physically grounded — the notification comes from the direction it lives.

---

## 6. Integration Usage (What the End User Writes)

```tsx
// App.tsx — root
import { ToastContainer } from "./src/toast";

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>...</Stack.Navigator>
      <ToastContainer position="bottom-center" /> {/* ← once, at root */}
    </NavigationContainer>
  );
}

// AnyScreen.tsx — anywhere in the app
import toast from "./src/toast";

function LoginScreen() {
  const handleLogin = async () => {
    await toast.promise(loginUser(creds), {
      loading: "Signing in...",
      success: "Welcome back!",
      error: (e) => e.message,
    });
  };

  return <Button onPress={handleLogin} title="Login" />;
}
```

---

## 7. Constraints & Edge Cases to Handle

| Case                                                | Behavior                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `toast()` called before `<ToastContainer />` mounts | Toast queued in `memoryState`, displayed when container mounts           |
| `toast.loading()` with no follow-up dismiss         | Stays forever (duration: Infinity). Caller must call `toast.dismiss(id)` |
| Duplicate `id`                                      | `UPSERT_TOAST` updates existing — no duplicate in list                   |
| `toast.promise()` rejects                           | Updates loading→error with `duration: 4000`, auto-dismisses              |
| App goes to background                              | Pause all timers on `AppState` `'background'` event in `useToaster`      |
| Rapid-fire toasts                                   | `TOAST_LIMIT = 3` slices oldest. User sees max 3 at once                 |
| Height not measured yet                             | Default height of `48` used in offset calc                               |
| Device rotation                                     | `onLayout` re-fires, heights update, offsets recalculate                 |

---

## 8. AppState Pause (Important for Mobile)

Add to `useToaster.ts`:

```ts
import { AppState } from "react-native";

useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state !== "active") {
      dispatch({ type: "START_PAUSE", time: Date.now() });
    } else {
      dispatch({ type: "END_PAUSE", time: Date.now() });
    }
  });
  return () => sub.remove();
}, []);
```

This ensures timers don't fire while app is backgrounded, then resume correctly.

---

## 9. Expo/React Native Specific Notes

- **No DOM.** No `document`, `window`, `CSS`, `className`. Everything is `StyleSheet`.
- **No `react-hot-toast` import.** Build from scratch.
- **Use `Animated` from `react-native`** — not `react-native-reanimated` unless already in the project. Check `package.json` first.
- **Use `react-native-safe-area-context`** for `useSafeAreaInsets()` to offset `ToastContainer` below status bar / above home indicator. Import: `import { useSafeAreaInsets } from 'react-native-safe-area-context'`. This is included in Expo by default.
- **Test on both platforms.** Shadow syntax differs: iOS uses `shadow*` props, Android uses `elevation`.
- **No web entry point** unless `expo-router` or `react-native-web` is already configured in the project.

---

## 10. Build Order for Agent

Execute in this order. Do not skip steps.

1. `core/types.ts` — define all types first, no logic
2. `core/store.ts` — pure reducer + module state, no React
3. `core/toast.ts` — imperative API, calls dispatch
4. `core/useToasterStore.ts` — React subscription hook
5. `core/useToaster.ts` — timer management + pause handlers
6. `components/ToastIcon.tsx` — isolated, no state
7. `components/ToastItem.tsx` — animation + layout, uses `useRef` + `Animated`
8. `components/ToastContainer.tsx` — reads `useToaster`, maps toasts → `ToastItem`
9. `index.ts` — clean public API export
10. Verify: `toast()` works from a plain function call in a screen component

After each file: check for TypeScript errors before moving to next.

---

## 11. What NOT to Do

- Do not use `useState` in `store.ts`. State lives in module scope.
- Do not use `setInterval` for timers. Use `setTimeout` per-toast.
- Do not call `REMOVE_TOAST` without `DISMISS_TOAST` first (skip animation).
- Do not use `position: 'absolute'` with numeric literals inline — use `StyleSheet`.
- Do not import from `react-hot-toast`. This is a reimplementation.
- Do not add `react-native-gesture-handler` for swipe-to-dismiss unless it's already in the project.
- Do not make `ToastContainer` accept a `children` prop.
- Do not render `null` for invisible toasts — render them with `opacity: 0` so exit animation can play.
