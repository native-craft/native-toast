import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import type { ToastType } from "../core/types";

const COLORS = {
  success: "#30D158",
  error: "#FF453A",
  neutral: "#636366",
};

interface ToastIconProps {
  type: ToastType;
}

export function ToastIcon({ type }: ToastIconProps) {
  if (type === "blank" || type === "custom") return null;

  if (type === "loading") {
    return <ActivityIndicator size="small" color={COLORS.neutral} />;
  }

  const isCheck = type === "success";
  const color = isCheck ? COLORS.success : COLORS.error;

  return (
    <View style={[styles.circle, { borderColor: color }]}>
      <Text style={[styles.icon, { color }]}>{isCheck ? "✓" : "✕"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
});
