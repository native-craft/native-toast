import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Pressable,
  Text,
  PanResponder,
} from 'react-native';
import type { Toast, ToastTheme } from '../core/types';
import { ToastIcon } from './ToastIcon';

const THEME_TOKENS = {
  dark: { surface: '#1C1C1E', text: '#FFFFFF', shadowOpacity: 0.15 },
  light: { surface: '#FFFFFF', text: '#1C1C1E', shadowOpacity: 0.08 },
};

interface ToastItemProps {
  toast: Toast;
  stackIndex: number;
  isExpanded: boolean;
  expandedOffset: number;
  theme: ToastTheme;
  onPress?: () => void;
  onDismiss: () => void;
  onUpdateHeight: (id: string, height: number) => void;
}

export function ToastItem({
  toast,
  stackIndex,
  isExpanded,
  expandedOffset,
  theme,
  onPress,
  onDismiss,
  onUpdateHeight,
}: ToastItemProps) {
  const toastVisibleRef = useRef(toast.visible);
  toastVisibleRef.current = toast.visible;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const opacity = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(-20)).current;
  const expandProgress = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY()).current;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast.visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(entryY, {
          toValue: -10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.visible]);

  useEffect(() => {
    Animated.spring(expandProgress, {
      toValue: isExpanded ? 1 : 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const collapsedScale = 1 - stackIndex * 0.06;
  const collapsedTranslateY = stackIndex * 6;
  const collapsedOpacity = Math.max(0, 1 - stackIndex * 0.15);

  const scale = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedScale, 1],
  });
  const translateYFromStack = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedTranslateY, expandedOffset],
  });
  const stackOpacity = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedOpacity, 1],
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        toastVisibleRef.current &&
        Math.abs(g.dy) > 5 &&
        Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) pan.setValue({ x: 0, y: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40) {
          Animated.timing(pan.y, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDismissRef.current());
        } else {
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

  const zIndex = 100 - stackIndex;

  const messageContent =
    typeof toast.message === 'function' ? toast.message(toast) : toast.message;

  const handleLayout = useCallback(
    (e: any) => {
      const { height } = e.nativeEvent.layout;
      if (toast.height !== height) {
        onUpdateHeight(toast.id, height);
      }
    },
    [toast.id, toast.height, onUpdateHeight]
  );

  const tokens = THEME_TOKENS[theme];

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        toast.style,
        {
          backgroundColor: tokens.surface,
          shadowOpacity: tokens.shadowOpacity,
          opacity: Animated.multiply(opacity, stackOpacity) as any,
          transform: [
            {
              translateY: Animated.add(
                entryY,
                Animated.add(translateYFromStack, pan.y)
              ) as any,
            },
            { scale },
          ],
          zIndex,
          position: 'absolute',
        },
      ]}
      onLayout={handleLayout}
    >
      <Pressable onPress={onPress} style={styles.inner}>
        <ToastIcon type={toast.type} size={20} customIcon={toast.icon} />
        {React.isValidElement(messageContent) ? (
          messageContent
        ) : (
          <Text
            selectable={false}
            allowFontScaling={false}
            style={[styles.message, { color: tokens.text }, toast.textStyle]}
            numberOfLines={2}
          >
            {messageContent}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    minWidth: 120,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flexShrink: 1,
  },
});
