import React, { useEffect, useRef, useCallback } from "react";
import { Animated, StyleSheet, View, Text } from "react-native";
import type { Toast, ToastPosition } from "../core/types";
import { ToastIcon } from "./ToastIcon";

interface ToastItemProps {
  toast: Toast;
  position: ToastPosition;
  offset: number;
  topOffset: number;
  bottomOffset: number;
  onUpdateHeight: (id: string, height: number) => void;
}

const ENTER_SPRING = { tension: 100, friction: 12 } as const;

export function ToastItem({
  toast,
  position,
  offset,
  topOffset,
  bottomOffset,
  onUpdateHeight,
}: ToastItemProps) {
  const opacity = useRef(new Animated.Value(toast.visible ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const isTop = position.startsWith("top");
  const initialY = isTop ? -20 : 20;

  useEffect(() => {
    translateY.setValue(initialY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (toast.visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          ...ENTER_SPRING,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: isTop ? -10 : 10,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.visible]);

  const handleLayout = useCallback(
    (e: any) => {
      const { height } = e.nativeEvent.layout;
      if (toast.height !== height) {
        onUpdateHeight(toast.id, height);
      }
    },
    [toast.id, toast.height, onUpdateHeight]
  );

  const positionStyle = isTop
    ? { top: topOffset + offset }
    : { bottom: bottomOffset + offset };

  const alignItems: "flex-start" | "center" | "flex-end" = position.endsWith(
    "left"
  )
    ? "flex-start"
    : position.endsWith("right")
      ? "flex-end"
      : "center";

  const messageContent =
    typeof toast.message === "function" ? toast.message(toast) : toast.message;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        positionStyle,
        { opacity, transform: [{ translateY }] },
        { alignItems },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.toast, toast.style]} onLayout={handleLayout}>
        <ToastIcon type={toast.type} />
        {React.isValidElement(messageContent) ? (
          messageContent
        ) : (
          <Text style={[styles.message, toast.textStyle]}>
            {messageContent}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  toast: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignSelf: "center",
  },
  message: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    flexShrink: 1,
  },
});
