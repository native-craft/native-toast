import React, { useState, useEffect } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToaster } from "../core/useToaster";
import { ToastItem } from "./ToastItem";
import toast from "../core/toast";
import type { ToastPosition } from "../core/types";

interface ToastContainerProps {
  position?: ToastPosition;
  topOffset?: number;
  bottomOffset?: number;
  gutter?: number;
}

export function ToastContainer({
  position = "top-center",
  topOffset = 50,
  bottomOffset = 40,
  gutter = 8,
}: ToastContainerProps) {
  const insets = useSafeAreaInsets();
  const { toasts, handlers } = useToaster();
  const [expanded, setExpanded] = useState(false);

  const isTop = position.startsWith("top");
  const activeVisible = toasts.filter((t) => t.visible);

  useEffect(() => {
    if (activeVisible.length <= 1) setExpanded(false);
  }, [activeVisible.length]);

  const edgeOffset = isTop
    ? topOffset + insets.top
    : bottomOffset + insets.bottom;

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
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
          {toasts.map((t) => {
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
                  if (!expanded && activeVisible.length > 1)
                    setExpanded(true);
                }}
                onDismiss={() => {
                  if (!expanded && activeVisible.length > 1) {
                    activeVisible.forEach((v) => toast.dismiss(v.id));
                  } else {
                    toast.dismiss(t.id);
                  }
                }}
                onUpdateHeight={handlers.updateHeight}
              />
            );
          })}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
