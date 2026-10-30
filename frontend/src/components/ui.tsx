// Plain building blocks shared by the screens. Styling comes later.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  type HostInstance,
  Keyboard,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
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

// Lets a text field ask its screen to scroll it into view when the keyboard opens.
const RevealContext = createContext<() => void>(() => {});

/** Call when a text field gets focus, so it isn't hidden behind the keyboard. */
export function useRevealFocused() {
  return useContext(RevealContext);
}

/** A scrollable page. Keeps the field being typed in visible above the keyboard,
 * and closes the keyboard when the page is scrolled. */
export function Screen({ children }: { children: React.ReactNode }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const content = useRef<HostInstance>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const reveal = useCallback(() => {
    // Wait for the keyboard to finish opening, then bring the field near the top.
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input || !content.current) return;
      input.measureLayout(
        content.current,
        (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }),
        () => {},
      );
    }, 250);
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      reveal();
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [reveal]);

  return (
    <RevealContext value={reveal}>
      <ScrollView
        ref={scroll}
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Room below the content while the keyboard is open, so everything can scroll into view. */}
        <View ref={content} style={[styles.screenContent, { paddingBottom: 24 + keyboardHeight }]}>
          {children}
        </View>
      </ScrollView>
    </RevealContext>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Field({ label, onFocus, ...input }: { label: string } & TextInputProps) {
  const reveal = useRevealFocused();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          onFocus?.(event);
          reveal();
        }}
        {...input}
      />
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
