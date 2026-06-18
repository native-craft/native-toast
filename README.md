# NativeToast

A zero-dependency, headless toast notification system for React Native (Expo) with an imperative API, animated SVG icons, stack mode, swipe dismiss, custom icons, and dark/light themes.

## Preview

<p align="center"><img src="./assets/hero.png" width="280" alt="NativeToast preview" /></p>

## Examples

| Example | Preview | Docs |
|---------|---------|------|
| Success | <img src="./assets/success.gif" width="180" alt="Success" /> | [Toast Types](https://native-toast-nc.vercel.app/features/toast-types) |
| Error | <img src="./assets/error.gif" width="180" alt="Error" /> | [Toast Types](https://native-toast-nc.vercel.app/features/toast-types) |
| Loading | <img src="./assets/loading.gif" width="180" alt="Loading" /> | [toast.loading](https://native-toast-nc.vercel.app/api/toast#toastloadingmessage-options) |
| Promise | <img src="./assets/promise.gif" width="180" alt="Promise" /> | [toast.promise](https://native-toast-nc.vercel.app/api/toast#toastpromisepromise-messages-options) |
| Stack Mode | <img src="./assets/stack.gif" width="180" alt="Stack Mode" /> | [Stack Mode](https://native-toast-nc.vercel.app/features/stack-mode) |
| Custom Icon | <img src="./assets/icon.gif" width="180" alt="Custom Icon" /> | [Custom Icons](https://native-toast-nc.vercel.app/features/custom-icons) |
| Emoji Icon | <img src="./assets/emoji.gif" width="180" alt="Emoji Icon" /> | [Emoji Icons](https://native-toast-nc.vercel.app/features/custom-icons#emoji-icons) |
| Multiline | <img src="./assets/ml.gif" width="180" alt="Multiline" /> | [Message Types](https://native-toast-nc.vercel.app/features/toast-types#message-types) |
| Default | <img src="./assets/normal.gif" width="180" alt="Default" /> | [Toast Types](https://native-toast-nc.vercel.app/features/toast-types) |
| Theming | <img src="./assets/theme.gif" width="180" alt="Theming" /> | [Theming](https://native-toast-nc.vercel.app/features/theming) |

## Installation

```bash
pnpm add @ncrft/native-toast
```

## Quick Start

```tsx
import { ToastContainer, toast } from '@ncrft/native-toast';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      {/* your app */}
      <ToastContainer />
    </SafeAreaProvider>
  );
}

// Call from anywhere
toast.success('Settings saved!');
```

## Documentation

Full docs at **[native-toast-nc.vercel.app](https://native-toast-nc.vercel.app)**
