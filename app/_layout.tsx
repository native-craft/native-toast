import { Stack } from "expo-router";
import { ToastContainer } from "@/src/toast";

export default function RootLayout() {
  return (
    <>
      <Stack />
      <ToastContainer />
    </>
  );
}
