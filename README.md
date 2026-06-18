# NativeToast

A zero-dependency, headless toast notification system for React Native (Expo) with an imperative API, animated SVG icons, stack mode, swipe dismiss, custom icons, and dark/light themes.

## Preview

<img src="https://files.catbox.moe/vzcwn9.gif" width="280" alt="Preview" />

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
