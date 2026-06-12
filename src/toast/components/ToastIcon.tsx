import React, { useEffect, useRef } from "react";
import { Animated, ActivityIndicator, StyleSheet, Text } from "react-native";
import Svg, { Circle, Polyline, Line } from "react-native-svg";
import type { ToastType } from "../core/types";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const COLORS = {
  success: "#30D158",
  error: "#FF453A",
  neutral: "#636366",
};

interface ToastIconProps {
  type: ToastType;
  size?: number;
  customIcon?: React.ReactNode;
}

export function ToastIcon({ type, size = 20, customIcon }: ToastIconProps) {
  if (customIcon) {
    if (typeof customIcon === "string") {
      return <Text style={styles.emoji}>{customIcon}</Text>;
    }
    return <>{customIcon}</>;
  }

  if (type === "blank" || type === "custom") return null;

  if (type === "loading") {
    return <ActivityIndicator size="small" color={COLORS.neutral} />;
  }

  if (type === "success") {
    return <SuccessIcon size={size} />;
  }

  if (type === "error") {
    return <ErrorIcon size={size} />;
  }

  return null;
}

function SuccessIcon({ size }: { size: number }) {
  const checkLength = Math.sqrt(18) + Math.sqrt(50);

  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const checkProgress = useRef(new Animated.Value(checkLength)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 12,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.spring(checkProgress, {
        toValue: 0,
        tension: 120,
        friction: 10,
        useNativeDriver: false,
      }).start();
    }, 200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Circle cx={10} cy={10} r={8} fill={COLORS.success} />
        <AnimatedPolyline
          points="6,10 9,13 14,7"
          stroke="#FFFFFF"
          strokeWidth={2}
          fill="none"
          strokeDasharray={checkLength}
          strokeDashoffset={checkProgress}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

function ErrorIcon({ size }: { size: number }) {
  const lineLength = Math.sqrt(72);

  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const line1Progress = useRef(new Animated.Value(lineLength)).current;
  const line2Progress = useRef(new Animated.Value(lineLength)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 12,
      useNativeDriver: true,
    }).start();

    const timer1 = setTimeout(() => {
      Animated.spring(line1Progress, {
        toValue: 0,
        tension: 120,
        friction: 10,
        useNativeDriver: false,
      }).start();
    }, 150);

    const timer2 = setTimeout(() => {
      Animated.spring(line2Progress, {
        toValue: 0,
        tension: 120,
        friction: 10,
        useNativeDriver: false,
      }).start();
    }, 250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Circle cx={10} cy={10} r={8} fill={COLORS.error} />
        <AnimatedLine
          x1={7}
          y1={7}
          x2={13}
          y2={13}
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeDasharray={lineLength}
          strokeDashoffset={line1Progress}
          strokeLinecap="round"
        />
        <AnimatedLine
          x1={13}
          y1={7}
          x2={7}
          y2={13}
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeDasharray={lineLength}
          strokeDashoffset={line2Progress}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emoji: {
    fontSize: 18,
    lineHeight: 20,
  },
});
