import { useRef } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Heart } from 'lucide-react-native';
import {
  toast,
  ToastContainer,
  useTheme,
  setTheme,
} from '@ncrft/native-toast';

export default function App() {
  const loadingIdRef = useRef<string | null>(null);
  const theme = useTheme();

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Pressable style={styles.themeToggle} onPress={toggleTheme}>
          <Text style={styles.themeToggleText}>
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Toast Types</Text>

        <Pressable
          style={styles.button}
          onPress={() => toast('Hello from blank toast!')}
        >
          <Text style={styles.buttonText}>Blank Toast</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: '#30D158' }]}
          onPress={() => toast.success('Operation successful!')}
        >
          <Text style={styles.buttonText}>Success</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: '#FF453A' }]}
          onPress={() => toast.error('Something went wrong')}
        >
          <Text style={styles.buttonText}>Error</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: '#5856D6' }]}
          onPress={() =>
            toast(
              'This is a longer message that wraps across multiple lines to test text layout in the toast bubble'
            )
          }
        >
          <Text style={styles.buttonText}>Multi-line</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: '#636366' }]}
          onPress={() => {
            if (loadingIdRef.current) {
              toast.dismiss(loadingIdRef.current);
              loadingIdRef.current = null;
            } else {
              loadingIdRef.current = toast.loading('Loading...');
            }
          }}
        >
          <Text style={styles.buttonText}>Loading (toggle)</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() =>
            toast.promise(
              new Promise<string>((resolve) =>
                setTimeout(() => resolve('done'), 2000)
              ),
              {
                loading: 'Fetching data...',
                success: (d: string) => `Got: ${d}`,
                error: 'Failed!',
              }
            )
          }
        >
          <Text style={styles.buttonText}>Promise Toast</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Custom Icons</Text>

        <Pressable
          style={styles.button}
          onPress={() => toast('File saved!', { icon: '💾' })}
        >
          <Text style={styles.buttonText}>💾 Emoji Icon</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: '#FF2D55' }]}
          onPress={() =>
            toast('Added to favorites!', {
              icon: <Heart size={20} color="#FF2D55" />,
            })
          }
        >
          <Text style={styles.buttonText}>Lucide Heart Icon</Text>
        </Pressable>
      </View>

      <ToastContainer theme={theme} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  themeToggle: {
    position: 'absolute',
    top: 60,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  themeToggleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
