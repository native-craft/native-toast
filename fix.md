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

**Use `react-native-svg`** — it is bundled in every Expo SDK. No install needed.

#### How react-hot-toast's icons work (web)

They use SVG `stroke-dashoffset` CSS animation. Each icon is an SVG path with:

- `strokeDasharray` = full path length (makes the stroke one long dash)
- `strokeDashoffset` animates from full length → 0, which "draws" the path

#### How we replicate this in React Native

Exact same technique. Different primitives:

- `Animated.createAnimatedComponent(Circle)` → `AnimatedCircle`
- `Animated.createAnimatedComponent(Polyline)` → `AnimatedPolyline`
- `Animated.createAnimatedComponent(Line)` → `AnimatedLine`
- Drive `strokeDashoffset` prop with `Animated.Value` via `Animated.spring`
- **`useNativeDriver: false`** — SVG props cannot use the native driver

#### Icon map

| type      | visual                          | animation                                    |
| --------- | ------------------------------- | -------------------------------------------- |
| `success` | Circle + checkmark polyline     | Circle draws → 150ms → checkmark draws       |
| `error`   | Circle + two diagonal lines (X) | Circle draws → 100ms → line1 → 200ms → line2 |
| `loading` | `<ActivityIndicator />`         | Platform native spinner                      |
| `blank`   | nothing                         | —                                            |
| `custom`  | nothing                         | —                                            |

#### Geometry (base: 20×20 viewBox, `size` prop scales everything)

```
strokeWidth = size * 0.1
radius r = (size - strokeWidth) / 2
center = size / 2
circumference = 2π × r   ← full circle dash length

SUCCESS checkmark points (scaled from 20×20):
  "4,10  8,14  16,6"  scaled by (size/20)
  checkLength ≈ √(4²+4²) + √(8²+8²) scaled

ERROR X lines (scaled from 20×20):
  Line1: (6,6) → (14,14)
  Line2: (14,6) → (6,14)
  lineLength = √2 × 8 × (size/20)
```

#### Animation timing

```
Success:
  circleProgress: Animated.spring(toValue: 0, tension: 100, friction: 10)
  checkProgress:  setTimeout(150ms) → Animated.spring(toValue: 0, tension: 120, friction: 10)

Error:
  circleProgress: Animated.spring(toValue: 0, tension: 100, friction: 10)
  line1Progress:  setTimeout(100ms) → Animated.spring(toValue: 0, tension: 120, friction: 10)
  line2Progress:  setTimeout(200ms) → Animated.spring(toValue: 0, tension: 120, friction: 10)
```

#### Required imports

```ts
import Svg, { Circle, Polyline, Line } from "react-native-svg";
import { Animated, ActivityIndicator } from "react-native";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedLine = Animated.createAnimatedComponent(Line);
```

See `ToastIcon.tsx` (delivered separately) for the full working implementation.

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

---

## 12. PATCH — Bug Fixes + New Features

> These override/extend previous sections where they conflict.

### 12.1 Bug: Text selection highlight flash on first render

**What you saw in the screenshot:** The topmost toast renders with a gray rounded rectangle behind the text for a brief moment — looks like a native text selection highlight.

**Root cause:** React Native's `<Text>` component has `selectable` defaulting to `false`, but the parent `<TouchableOpacity>` or `<Pressable>` can trigger a pressed-state highlight on initial mount if the component flashes through a "touched" state during the entry animation. Also: if `<Text>` is inside a pressable, long-press triggers the OS selection UI.

**Fix — apply ALL of these:**

```tsx
// On the <Text> component inside ToastItem:
<Text
  selectable={false}           // ← disables OS text selection entirely
  allowFontScaling={false}     // ← prevents font scaling from breaking layout
  style={styles.message}
>
  {message}
</Text>

// On the pressable wrapper:
// Use Pressable instead of TouchableOpacity
// Set android_ripple={null} to suppress Android ripple artifact
<Pressable
  android_ripple={null}
  onPress={handlePress}
  style={...}
>

// In StyleSheet, add to the toast container view:
{
  // Prevents the highlight from leaking outside the toast shape
  overflow: 'hidden',
}
```

Also: **never wrap the Text in a View that itself has a pressable ancestor with `underlayColor`**. If using `TouchableHighlight` anywhere, replace it with `Pressable`.

---

### 12.2 Bug: Toast too wide (full screen width)

**What you saw:** Toasts stretch edge-to-edge. Should be pill-shaped and centered with content-driven width.

**Fix — `ToastItem` container style:**

```tsx
const styles = StyleSheet.create({
  container: {
    // DO NOT set width or alignSelf: 'stretch'
    alignSelf: "center", // ← shrink-wraps to content
    maxWidth: "85%", // ← never wider than 85% of screen
    minWidth: 120, // ← never too narrow for short messages
    // ... rest of shadow/bg styles
  },
});
```

**`ToastContainer` must also NOT set a fixed width on its children.** The absolute-positioned wrapper should be full-width (`left: 0, right: 0`) so toasts can `alignSelf: 'center'` within it correctly.

```tsx
// ToastContainer wrapper style:
{
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,         // or bottom: 0 depending on position prop
  alignItems: 'center',   // ← centers children horizontally
  pointerEvents: 'box-none',
}
```

---

### 12.3 New Feature: Stack Mode — Collapsed by Default, Tap to Expand

**Behavior spec:**

- When 2+ toasts are visible: show only the **frontmost toast** fully, stack the others behind it as peeking cards (shifted down slightly, scaled down slightly, lower opacity).
- User taps the stack → all toasts expand into a full list (stacked with gaps).
- User taps again → collapse back to stack view.
- This is a **pure UI state** — does not affect the store. Use `useState` in `ToastContainer`.

**Visual spec for stacked (collapsed) mode:**

```
Toast 0 (front, full opacity, full scale):     [  Hello from blank toast!  ]
Toast 1 (behind, 90% scale, 6px lower):           [    Hello from...    ]
Toast 2 (behind, 80% scale, 12px lower):              [   Hello...   ]
```

Each stacked card behind the front is:

- `scale`: `1 - (index * 0.06)` — shrinks slightly per depth
- `translateY`: `index * 6` — peeks below the front card
- `opacity`: `1 - (index * 0.15)` — fades with depth
- `zIndex`: descending — front card is highest

**State in `ToastContainer`:**

```tsx
const [expanded, setExpanded] = useState(false);
const visibleToasts = toasts.filter((t) => t.visible);

// Toggle on tap
const handleStackPress = () => setExpanded((prev) => !prev);
```

**Rendering logic:**

```tsx
// In collapsed mode:
// Render ALL visible toasts but transform them into the stack
// The stack is a single touch target (Pressable wrapping all)

// In expanded mode:
// Each toast is independently positioned with proper gap offsets
// Each toast has its own swipe-to-dismiss handler
```

**Animation — use `Animated.spring` to transition between states:**

```tsx
// Each ToastItem receives: stackIndex, isExpanded, totalCount
// ToastItem computes its own transform based on these

// Collapsed:
translateY = stackIndex * 6;
scale = 1 - stackIndex * 0.06;
opacity = 1 - stackIndex * 0.15;

// Expanded:
translateY = calculateOffset(toasts, toast, gutter); // normal stacking
scale = 1;
opacity = 1;

// Animate between states with Animated.spring on a shared expandProgress value
// expandProgress: 0 = collapsed, 1 = expanded
// Interpolate each transform from collapsed → expanded values
```

**`ToastItem` new props:**

```ts
interface ToastItemProps {
  toast: Toast;
  stackIndex: number; // position in visible stack (0 = front)
  isExpanded: boolean;
  expandedOffset: number; // pre-calculated Y offset in expanded mode
  onPress?: () => void; // tap to expand/collapse
  onDismiss: () => void; // called when swipe-up completes
  position: "top" | "bottom";
}
```

**Auto-collapse:** When `visibleToasts.length` drops to 1, set `expanded = false` automatically via `useEffect`.

```tsx
useEffect(() => {
  if (visibleToasts.length <= 1) setExpanded(false);
}, [visibleToasts.length]);
```

---

### 12.4 New Feature: Swipe Up to Dismiss

**Behavior:** User swipes a toast upward → toast flies off-screen → `toast.dismiss(id)` is called.
Works in **expanded mode only**. In collapsed mode the whole stack is one press target.

**Implementation — use `PanResponder` (no extra deps):**

```tsx
// Inside ToastItem, add PanResponder
const pan = useRef(new Animated.ValueXY()).current;
const swipeThreshold = -40; // px upward to trigger dismiss

const panResponder = useRef(
  PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only capture vertical-dominant swipes
      return (
        Math.abs(gestureState.dy) > 5 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      );
    },
    onPanResponderMove: (_, gestureState) => {
      // Only allow upward drag (dy is negative when swiping up)
      if (gestureState.dy < 0) {
        pan.setValue({ x: 0, y: gestureState.dy });
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy < swipeThreshold) {
        // Threshold crossed — fly out
        Animated.timing(pan.y, {
          toValue: -300,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onDismiss(); // calls toast.dismiss(id)
        });
      } else {
        // Snap back
        Animated.spring(pan.y, {
          toValue: 0,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }).start();
      }
    },
  })
).current;

// Apply to Animated.View:
<Animated.View
  {...(isExpanded ? panResponder.panHandlers : {})}
  style={[
    styles.container,
    { transform: [{ translateY: pan.y }] },
  ]}
>
```

**Only attach `panResponder.panHandlers` when `isExpanded === true`.** In collapsed mode, the stack is a single tap target, not swipeable.

**For bottom-positioned toasts:** flip the swipe direction. Dismiss on `dy > 40` (swipe down).

```tsx
const swipeThreshold = position === "top" ? -40 : 40;
const flyOutValue = position === "top" ? -300 : 300;

// In onMoveShouldSetPanResponder:
const isCorrectDirection =
  position === "top" ? gestureState.dy < 0 : gestureState.dy > 0;
```

---

### 12.5 Updated `ToastContainer` Full Logic

```tsx
export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = "top-center",
  topOffset = 50,
  bottomOffset = 40,
  gutter = 8,
}) => {
  const { toasts } = useToaster();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  const isTop = position.startsWith("top");
  const visibleToasts = toasts.filter((t) => t.visible || !t.visible); // include hidden for exit anim
  const activeVisible = toasts.filter((t) => t.visible);

  // Auto-collapse when only 1 or 0 visible
  useEffect(() => {
    if (activeVisible.length <= 1) setExpanded(false);
  }, [activeVisible.length]);

  const edgeOffset = isTop
    ? topOffset + insets.top
    : bottomOffset + insets.bottom;

  // Calculate expanded offsets
  let runningOffset = 0;
  const expandedOffsets: Record<string, number> = {};
  const orderedVisible = isTop
    ? [...activeVisible]
    : [...activeVisible].reverse();
  orderedVisible.forEach((t) => {
    expandedOffsets[t.id] = runningOffset;
    runningOffset += (t.height ?? 48) + gutter;
  });

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "box-none" }]}>
      {/* Invisible tap target for collapse when expanded */}
      {expanded && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setExpanded(false)}
        />
      )}

      <View
        style={[
          styles.stack,
          isTop ? { top: edgeOffset } : { bottom: edgeOffset },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => {
            if (!expanded && activeVisible.length > 1) setExpanded(true);
          }}
          style={{ alignItems: "center" }}
        >
          {toasts.map((t, i) => {
            const stackIndex = activeVisible.findIndex((v) => v.id === t.id);
            return (
              <ToastItem
                key={t.id}
                toast={t}
                stackIndex={stackIndex === -1 ? 0 : stackIndex}
                isExpanded={expanded}
                expandedOffset={expandedOffsets[t.id] ?? 0}
                position={isTop ? "top" : "bottom"}
                onPress={() => {
                  if (!expanded && activeVisible.length > 1) setExpanded(true);
                }}
                onDismiss={() => toast.dismiss(t.id)}
              />
            );
          })}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
```

---

### 12.6 Updated `ToastItem` Full Visual + Animation Logic

```tsx
// ToastItem.tsx — full layout logic

export const ToastItem: React.FC<ToastItemProps> = ({
  toast,
  stackIndex,
  isExpanded,
  expandedOffset,
  position,
  onPress,
  onDismiss,
}) => {
  // --- Entry/exit animation (for the toast itself appearing/disappearing)
  const opacity = useRef(new Animated.Value(0)).current;
  const entryY = useRef(
    new Animated.Value(position === "top" ? -20 : 20),
  ).current;

  // --- Stack/expand animation
  const expandProgress = useRef(new Animated.Value(0)).current;

  // --- Swipe (pan) for dismiss
  const pan = useRef(new Animated.ValueXY()).current;

  // Entry animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.spring(entryY, {
        toValue: 0,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Exit animation when toast.visible goes false
  useEffect(() => {
    if (!toast.visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(entryY, {
          toValue: position === "top" ? -10 : 10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toast.visible]);

  // Expand/collapse animation
  useEffect(() => {
    Animated.spring(expandProgress, {
      toValue: isExpanded ? 1 : 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  // Stack transforms (collapsed state)
  const collapsedScale = 1 - stackIndex * 0.06;
  const collapsedTranslateY = stackIndex * 6 * (position === "top" ? 1 : -1);
  const collapsedOpacity = Math.max(0, 1 - stackIndex * 0.15);

  // Expanded transforms
  const expandedTranslateY = expandedOffset * (position === "top" ? 1 : -1);

  // Interpolate between collapsed and expanded
  const scale = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedScale, 1],
  });
  const translateYFromStack = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedTranslateY, expandedTranslateY],
  });
  const stackOpacity = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedOpacity, 1],
  });

  // PanResponder for swipe dismiss
  const swipeThreshold = position === "top" ? -40 : 40;
  const flyOutValue = position === "top" ? -300 : 300;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        isExpanded && Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const isCorrectDir = position === "top" ? g.dy < 0 : g.dy > 0;
        if (isCorrectDir) pan.setValue({ x: 0, y: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        const triggered =
          position === "top" ? g.dy < swipeThreshold : g.dy > swipeThreshold;

        if (triggered) {
          Animated.timing(pan.y, {
            toValue: flyOutValue,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss);
        } else {
          Animated.spring(pan.y, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // zIndex — front toast (stackIndex 0) is highest
  const zIndex = 100 - stackIndex;

  return (
    <Animated.View
      {...(isExpanded ? panResponder.panHandlers : {})}
      style={[
        styles.container,
        {
          opacity: Animated.multiply(opacity, stackOpacity) as any,
          transform: [
            {
              translateY: Animated.add(
                entryY,
                Animated.add(translateYFromStack, pan.y),
              ) as any,
            },
            { scale },
          ],
          zIndex,
          position: "absolute", // all items stack on top of each other
        },
      ]}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h !== toast.height) {
          // Update height in store for offset calculation
          // (call handlers.updateHeight(toast.id, h) passed from container)
        }
      }}
    >
      <Pressable onPress={onPress} android_ripple={null} style={styles.inner}>
        <ToastIcon type={toast.type} size={20} />
        <Text
          selectable={false}
          allowFontScaling={false}
          style={styles.message}
          numberOfLines={2}
        >
          {typeof toast.message === "string" ? toast.message : null}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    maxWidth: "85%",
    minWidth: 120,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    overflow: "hidden", // ← kills the text highlight bleed
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Android
    elevation: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  message: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    flexShrink: 1, // ← allows text to wrap instead of stretching container
  },
});
```

---

### 12.7 Key Correctness Rules for Patch Features

**Animated.multiply / Animated.add for combined transforms:**
React Native doesn't allow you to do math on `Animated.Value` inline. Use the built-in combinators:

- `Animated.add(a, b)` → sum of two animated values
- `Animated.multiply(a, b)` → product
- `.interpolate()` for mapping ranges

**`position: 'absolute'` on all ToastItems:**
Since all toasts stack at `position: 'absolute'`, the container's height is 0. The container itself uses a fixed `top`/`bottom` offset from the edge. Each item's `translateY` positions it within the stack.

**`Animated.multiply(opacity, stackOpacity)` type cast:**
TypeScript may complain about `Animated.multiply` not being `StyleProp`. Cast with `as any` — this is correct at runtime.

**Do not animate `zIndex`:**
`zIndex` cannot be animated with native driver. Set it as a static value derived from `stackIndex`. Re-render on stack index change is fine — it only changes when toasts are added/removed.

**`gap` in StyleSheet:**
`gap` works in React Native 0.71+. If the Expo SDK version predates this, use `marginLeft: 10` on the icon `View` instead.

**`pointerEvents` on View vs prop:**
In React Native 0.73+, `pointerEvents` is a style prop. In older versions it's a direct prop on `View`. Use the direct prop form for compatibility:

```tsx
<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
```
