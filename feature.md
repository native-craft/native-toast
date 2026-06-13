# Toast System — Complete Feature List

A zero-dependency, headless toast notification system for React Native (Expo) with an imperative API, animated SVG icons, stack mode, swipe dismiss, custom icons, and dark/light themes.

---

## 1. Core API

| Method                             | Description                                               | Default Duration         |
| ---------------------------------- | --------------------------------------------------------- | ------------------------ |
| `toast(message, options?)`         | Generic blank toast — no built-in icon                    | 4000ms                   |
| `toast.success(message, options?)` | Success toast with animated checkmark SVG                 | 2000ms                   |
| `toast.error(message, options?)`   | Error toast with animated X-mark SVG                      | 4000ms                   |
| `toast.loading(message, options?)` | Loading toast with native ActivityIndicator               | ∞ (never auto-dismisses) |
| `toast.custom(message, options?)`  | Custom toast — no built-in icon, message can be ReactNode | 4000ms                   |
| `toast.dismiss(toastId?)`          | Triggers exit animation then removes. No ID = dismiss all | —                        |
| `toast.remove(toastId?)`           | Immediately removes with no animation. No ID = remove all | —                        |
| `toast.promise(promise, msgs)`     | Shows loading → success/error based on resolution         | —                        |

- All methods return the toast `id` string (except `dismiss`/`remove`)
- Auto-incrementing IDs (`t_1`, `t_2`, …) or custom via `opts.id`
- **Upsert behavior**: same `id` updates existing toast instead of creating duplicate

---

## 2. Toast Types & Variants

| Type      | Icon                             | Use Case               |
| --------- | -------------------------------- | ---------------------- |
| `blank`   | None                             | Generic notifications  |
| `success` | Animated green checkmark SVG     | Positive confirmations |
| `error`   | Animated red X-mark SVG          | Error states           |
| `loading` | Native ActivityIndicator spinner | Async operations       |
| `custom`  | None (use `icon` option)         | Fully custom content   |

- **Message types**: plain string, any `ReactNode`, or render function `(toast) => ReactNode`
- **User overrides**: `opts.style` and `opts.textStyle` spread onto the toast container and text

---

## 3. Animation System

### Entry Animation

- **Spring-based fade + slide**: opacity 0→1, translateY -20→0
- **Spring config**: tension 100, friction 12
- Triggers on mount

### Exit Animation

- **Timing-based fade + slide up**: opacity 1→0, translateY 0→-10
- **Duration**: 150ms
- Triggers when `toast.visible` becomes `false`

### SVG Icon Animations

- **Success checkmark**: scale spring (0.3→1, tension 200, friction 12) + stroke-draw with 200ms delay
- **Error X-mark**: scale spring (same config) + two staggered line-draws (150ms and 250ms delay)
- Uses `Animated.createAnimatedComponent` for `Polyline` and `Line`

### Stack Expand/Collapse

- Spring-animated `expandProgress` (0=collapsed, 1=expanded, tension 100, friction 12)
- Interpolates scale, translateY, and opacity

### Swipe Gesture Anim

- **Fling-off**: `Animated.timing` to Y=-300 over 200ms when threshold exceeded
- **Snap-back**: `Animated.spring` to Y=0 when threshold not met (tension 100, friction 10)

### Combined Transform Pipeline

- **translateY**: `entryY + stackTranslateY + pan.y` (via `Animated.add`)
- **opacity**: `entryOpacity × stackOpacity` (via `Animated.multiply`)

---

## 4. Stack Mode

### Collapsed Stack (default)

- Multiple toasts overlap with depth-based visual reduction
- **Scale**: `1 - stackIndex × 0.06` (front=1.0, second=0.94, third=0.88)
- **Offset**: `stackIndex × 6px` downward
- **Opacity**: `max(0, 1 - stackIndex × 0.15)`

### Expanded Stack

- All toasts spread out vertically, fully visible
- Position calculated from cumulative measured heights + gutter spacing
- Uniform scale and full opacity

### Stack Interactions

- **Tap to toggle**: tap stack to expand, tap again to collapse
- **Auto-collapse**: stack auto-collapses when only 1 toast remains
- **Backdrop dismiss**: tapping outside expanded toasts collapses the stack
- **Bulk dismiss**: dismissing a toast in collapsed mode dismisses ALL toasts
- **Single dismiss**: dismissing in expanded mode removes only that toast
- **Z-index**: `100 - stackIndex` ensures correct visual layering

---

## 5. Gesture Handling (PanResponder)

| Behavior             | Detail                                         |
| -------------------- | ---------------------------------------------- |
| Swipe direction      | Vertical only (upward to dismiss)              |
| Activation threshold | `\|dy\| > 5` AND `\|dy\| > \|dx\|`             |
| Dismiss threshold    | `dy < -40px`                                   |
| Horizontal lock-out  | Horizontal swipes ignored                      |
| Tap passthrough      | `onStartShouldSetPanResponder` returns `false` |
| Visibility guard     | Pan only activates when toast is visible       |
| Stale closure fix    | Uses refs for `toastVisible` and `onDismiss`   |

---

## 6. Custom Icons

| Icon Input                        | Rendering                                          |
| --------------------------------- | -------------------------------------------------- |
| No `icon` prop                    | Built-in icon per toast type                       |
| `icon: "💾"` (string)             | Rendered in `<Text fontSize={18}>` — emoji support |
| `icon: <Ionicons .../>` (element) | Rendered as-is — any React element                 |
| `icon` on success/error           | **Overrides** built-in SVG icon                    |

---

## 7. Theming

### Dark Theme (default)

| Token           | Value     |
| --------------- | --------- |
| `surface`       | `#1C1C1E` |
| `text`          | `#FFFFFF` |
| `shadowOpacity` | `0.15`    |

### Light Theme

| Token           | Value     |
| --------------- | --------- |
| `surface`       | `#FFFFFF` |
| `text`          | `#1C1C1E` |
| `shadowOpacity` | `0.08`    |

- **Container-level**: `<ToastContainer theme="dark" | "light" />`
- **Global theme store**: `setTheme("light")` from anywhere + `useTheme()` hook to read
- Theme tokens applied to background, text color, and shadow opacity
- User `style`/`textStyle` overrides take precedence over theme tokens

---

## 8. Timer & Lifecycle

| Feature            | Detail                                                      |
| ------------------ | ----------------------------------------------------------- |
| Auto-dismiss       | Each toast auto-dismisses after its duration                |
| `REMOVE_DELAY`     | 1000ms gap between dismiss (exit animation) and removal     |
| AppState pause     | Timers pause when app goes to background                    |
| AppState resume    | Timers resume with correct remaining time on foreground     |
| Pause accumulation | Total paused time tracked across multiple background cycles |
| Infinity duration  | Loading toasts excluded from timer entirely                 |
| Two-phase removal  | `DISMISS_TOAST` → `REMOVE_TOAST` (exit anim → cleanup)      |
| Timer cleanup      | All pending timeouts cleaned up on state change             |

---

## 9. State Management

| Feature             | Detail                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Pattern**         | Module-level state store with observer (not React context)                                               |
| **Reducer**         | Pure function handling 7 action types                                                                    |
| **Actions**         | `ADD_TOAST`, `UPDATE_TOAST`, `UPSERT_TOAST`, `DISMISS_TOAST`, `REMOVE_TOAST`, `START_PAUSE`, `END_PAUSE` |
| **TOAST_LIMIT**     | Max 3 simultaneous toasts (older dropped)                                                                |
| **Listener system** | `addListener(fn)` → unsubscribe function                                                                 |
| **React bridge**    | `useToasterStore()` hook subscribes to store                                                             |
| **Upsert**          | Same ID updates existing toast instead of duplicating                                                    |
| **Dismiss all**     | `toast.dismiss()` with no ID dismisses all                                                               |
| **Remove all**      | `toast.remove()` with no ID clears all                                                                   |

---

## 10. Layout & Positioning

| Feature                | Detail                                                     |
| ---------------------- | ---------------------------------------------------------- |
| **Position**           | Top-center (hardcoded)                                     |
| **topOffset**          | Configurable vertical offset (default 50px)                |
| **Safe area**          | Integrated via `useSafeAreaInsets()`                       |
| **gutter**             | Configurable gap between expanded toasts (default 8px)     |
| **Height measurement** | Each toast self-measures via `onLayout`                    |
| **Fallback height**    | 48px used before measurement completes                     |
| **Overlay**            | Full-screen `absoluteFill` with `pointerEvents="box-none"` |
| **Max width**          | 85% of screen                                              |
| **Min width**          | 120px                                                      |
| **Content layout**     | Horizontal row: icon (left) + message (right)              |
| **Text max lines**     | 2 lines with ellipsis                                      |
| **Font scaling**       | Disabled (`allowFontScaling={false}`)                      |
| **Text selection**     | Disabled (`selectable={false}`)                            |

---

## 11. Public API Exports

```
import {
  toast,           // Imperative API object
  useToaster,      // Timer management hook
  useToasterStore, // State subscription hook
  ToastContainer,  // Root overlay component
  useTheme,        // Theme reader hook
  setTheme,        // Theme setter function
  type Toast,
  type ToastOptions,
  type ToastType,
  type ToastTheme,
  type ToastMessage,
} from "@ncrft/native-toast";
```

---

## 12. Technical Decisions

| Decision                               | Rationale                                             |
| -------------------------------------- | ----------------------------------------------------- |
| `Animated` (not Reanimated)            | Built-in, no worklet setup needed                     |
| `react-native-svg`                     | Animated SVG icons with stroke-dashoffset             |
| `PanResponder` (not gesture-handler)   | Built-in, no extra dependency                         |
| Module-level store                     | Accessible outside React (imperative `toast()` calls) |
| Container-level theme                  | Simpler API than per-toast themes                     |
| `useNativeDriver: false` for SVG       | stroke-dashoffset not a native transform              |
| `useNativeDriver: true` for entry/exit | Scale/opacity animations use native driver            |
