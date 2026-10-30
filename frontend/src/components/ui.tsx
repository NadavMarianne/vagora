// Plain building blocks shared by the screens. Styling comes later.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  type HostInstance,
  Keyboard,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { Tappable } from "@/components/tappable";

export const colors = {
  primary: "#208AEF",
  text: "#111111",
  muted: "#666666",
  border: "#CCCCCC",
  error: "#C62828",
  background: "#FFFFFF",
};

// Lets parts of a page ask it to scroll something into view.
type Reveal = {
  /** The text field that just got focus. */
  focused: () => void;
  /** Any part of the page, like a section that just opened. */
  view: (target: HostInstance | null) => void;
};
const RevealContext = createContext<Reveal>({ focused: () => {}, view: () => {} });

/** Call when a text field gets focus, so it isn't hidden behind the keyboard. */
export function useRevealFocused() {
  return useContext(RevealContext).focused;
}

/** Call with a part of the page to scroll it to the top, for example a section that just opened. */
export function useRevealView() {
  return useContext(RevealContext).view;
}

// Room to leave for the keyboard before it reports its real height: about half the screen.
const EXPECTED_KEYBOARD = Dimensions.get("window").height * 0.45;
// How far below the top of the screen something scrolls to, so a little context stays visible.
const TOP_MARGIN = 80;

/** A scrollable page. Keeps the field being typed in visible above the keyboard, scrolls
 * opened sections into view, and closes the keyboard when the page is scrolled. */
export function Screen({ children }: { children: React.ReactNode }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const content = useRef<HostInstance>(null);
  const [keyboardRoom, setKeyboardRoom] = useState(0);

  const scrollTo = useCallback((target: HostInstance) => {
    if (!content.current) return;
    target.measureLayout(
      content.current,
      (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - TOP_MARGIN), animated: true }),
      () => {},
    );
  }, []);

  const focused = useCallback(() => {
    // Make room for the keyboard right away, so the scroll isn't stopped by the end of the page,
    // then scroll on the next frame without waiting for the keyboard to finish opening.
    setKeyboardRoom((room) => room || EXPECTED_KEYBOARD);
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (input) scrollTo(input);
    });
  }, [scrollTo]);

  const view = useCallback(
    (target: HostInstance | null) => {
      // Next frame, so a section that just opened has its contents laid out.
      if (target) requestAnimationFrame(() => scrollTo(target));
    },
    [scrollTo],
  );

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardRoom(event.endCoordinates.height);
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardRoom(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return (
    <RevealContext value={{ focused, view }}>
      <ScrollView
        ref={scroll}
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Room below the content while the keyboard is open, so everything can scroll into view. */}
        <View ref={content} style={[styles.screenContent, { paddingBottom: 24 + keyboardRoom }]}>
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
    <Tappable
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
    </Tappable>
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
