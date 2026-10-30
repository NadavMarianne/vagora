// Plain building blocks shared by the screens. Styling comes later.
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

export const colors = {
  primary: "#208AEF",
  text: "#111111",
  muted: "#666666",
  border: "#CCCCCC",
  error: "#C62828",
  background: "#FFFFFF",
};

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.muted} {...input} />
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = "primary",
}: {
  title: string;
  onPress: () => Promise<void> | void;
  kind?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);

  async function press() {
    if (busy) return;
    setBusy(true);
    try {
      await onPress();
    } finally {
      setBusy(false);
    }
  }

  const primary = kind === "primary";
  return (
    <Pressable
      onPress={press}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || busy) && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.background : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, !primary && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.error, fontSize: 15 },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 1, borderColor: colors.primary },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: colors.primary },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
