import { useEffect, useState } from "react";
import type { ToastTheme } from "./types";

type Listener = (theme: ToastTheme) => void;

let currentTheme: ToastTheme = "dark";
const listeners: Listener[] = [];

export function setTheme(theme: ToastTheme) {
  currentTheme = theme;
  listeners.forEach((l) => l(theme));
}

export function useTheme(): ToastTheme {
  const [theme, setState] = useState<ToastTheme>(currentTheme);

  useEffect(() => {
    setState(currentTheme);
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return theme;
}
