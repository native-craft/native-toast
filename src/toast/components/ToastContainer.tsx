import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToaster } from "../core/useToaster";
import { ToastItem } from "./ToastItem";
import type { ToastPosition, Toast } from "../core/types";

interface ToastContainerProps {
  position?: ToastPosition;
  topOffset?: number;
  bottomOffset?: number;
  gutter?: number;
}

function calculateOffset(
  toasts: Toast[],
  currentToast: Toast,
  gutter: number
): number {
  const visibleToasts = toasts.filter(
    (t) => t.visible || t.id === currentToast.id
  );
  const index = visibleToasts.findIndex((t) => t.id === currentToast.id);
  return visibleToasts
    .slice(0, index)
    .reduce((acc, t) => acc + (t.height ?? 48) + gutter, 0);
}

export function ToastContainer({
  position = "top-center",
  topOffset,
  bottomOffset,
  gutter = 8,
}: ToastContainerProps) {
  const insets = useSafeAreaInsets();
  const { toasts, handlers } = useToaster();

  const resolvedTopOffset = topOffset ?? insets.top + 6;
  const resolvedBottomOffset = bottomOffset ?? insets.bottom + 6;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          toast={t}
          position={position}
          offset={calculateOffset(toasts, t, gutter)}
          topOffset={resolvedTopOffset}
          bottomOffset={resolvedBottomOffset}
          onUpdateHeight={handlers.updateHeight}
        />
      ))}
    </View>
  );
}
