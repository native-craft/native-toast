import { Stack } from "expo-router";
import { ToastContainer } from "@/src/toast";
import { useTheme } from "@/src/toast";

export default function RootLayout() {
  const theme = useTheme();

  return (
    <>
      <Stack />
      <ToastContainer theme={theme} />
    </>
  );
}
