import { View, StyleSheet, Pressable, Text } from "react-native";
import { toast } from "@/src/toast";

export default function Index() {
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={() => toast("Hello from blank toast!")}
      >
        <Text style={styles.buttonText}>Blank Toast</Text>
      </Pressable>

      <Pressable
        style={[styles.button, { backgroundColor: "#30D158" }]}
        onPress={() => toast.success("Operation successful!")}
      >
        <Text style={styles.buttonText}>Success</Text>
      </Pressable>

      <Pressable
        style={[styles.button, { backgroundColor: "#FF453A" }]}
        onPress={() => toast.error("Something went wrong")}
      >
        <Text style={styles.buttonText}>Error</Text>
      </Pressable>

      <Pressable
        style={[styles.button, { backgroundColor: "#636366" }]}
        onPress={() => toast.loading("Loading...")}
      >
        <Text style={styles.buttonText}>Loading (stays forever)</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() =>
          toast.promise(
            new Promise<string>((resolve) =>
              setTimeout(() => resolve("done"), 2000)
            ),
            {
              loading: "Fetching data...",
              success: (d: string) => `Got: ${d}`,
              error: "Failed!",
            }
          )
        }
      >
        <Text style={styles.buttonText}>Promise Toast</Text>
      </Pressable>

      <Pressable
        style={[styles.button, { backgroundColor: "#5856D6" }]}
        onPress={() => {
          toast.success("First");
          setTimeout(() => toast.error("Second"), 300);
          setTimeout(() => toast("Third"), 600);
        }}
      >
        <Text style={styles.buttonText}>Rapid Fire (x3)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  button: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
