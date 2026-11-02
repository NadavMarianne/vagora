// Plain building blocks shared by the screens. Styling comes later.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
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

import { FoldRegistry } from "@/components/folds";
import { Tappable } from "@/components/tappable";

export const colors = {
  primary: "#208AEF",
  text: "#111111",
  muted: "#666666",
  border: "#CCCCCC",
  error: "#C62828",
  background: "#FFFFFF",
  // Buttons that agree or admit, and buttons that contest or dispute.
  good: "#2E7D32",
  bad: "#C62828",
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
    // FoldRegistry: on Android, back closes this page's open sections before leaving it.
    <FoldRegistry>
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
    </FoldRegistry>
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

/** A highlighted explanation: what a page is for, or what happens next. */
export function Info({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.info}>
      {title && <Text style={styles.infoTitle}>{title}</Text>}
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

type ButtonKind = "primary" | "secondary" | "good" | "bad";

const BUTTON_COLOR: Record<ButtonKind, string> = {
  primary: colors.primary,
  secondary: colors.primary,
  good: colors.good,
  bad: colors.bad,
};

type ButtonProps = {
  title: string;
  onPress: () => Promise<void> | void;
  kind?: ButtonKind;
};

/** The current time, updated every second. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** "2d 4h left", "5m 10s left". */
function timeLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const [d, h, m] = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60];
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s % 60}s left`;
  return `${s}s left`;
}

/** A button with a deadline. Its color fills it like a progress bar and drains smoothly as the
 * time between `from` and `until` runs out. Where it's filled, the title shows in white. */
export function TimedButton({
  from,
  until,
  kind = "primary",
  ...button
}: ButtonProps & { from: string; until: string }) {
  const now = useNow();
  const start = Date.parse(from);
  const end = Date.parse(until);
  const color = BUTTON_COLOR[kind];
  const [width, setWidth] = useState(0);
  // 1 when the time starts, 0 when it's up.
  const [progress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const at = Date.now();
    progress.setValue(end > start ? Math.min(1, Math.max(0, (end - at) / (end - start))) : 0);
    // One smooth, steady drain until the deadline, run by the phone's animation system.
    const drain = Animated.timing(progress, {
      toValue: 0,
      duration: Math.max(0, end - at),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    drain.start();
    return () => drain.stop();
  }, [progress, start, end]);

  // The colored layer slides left as time runs out; its white title slides back so it stays put.
  const fillShift = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const titleShift = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const left = timeLeft(end - now);

  return (
    <View
      style={[styles.timed, { borderColor: color }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Button {...button} kind={kind} timed={left} />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: color, transform: [{ translateX: fillShift }] },
        ]}
      >
        <Animated.View style={[styles.button, { transform: [{ translateX: titleShift }] }]}>
          <Text style={[styles.buttonText, { color: colors.background }]}>{button.title}</Text>
          <Text style={[styles.timeLeft, { color: colors.background }]}>{left}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = "primary",
  timed,
}: ButtonProps & {
  /** Set by TimedButton: the time left, shown under the title over its time bar. */
  timed?: string;
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

  const filled = kind !== "secondary";
  const color = BUTTON_COLOR[kind];
  // A timed button's color is drawn behind it as a time bar, so the button itself is clear.
  const background = timed !== undefined ? "transparent" : filled ? color : colors.background;
  const textColor = timed !== undefined ? colors.text : filled ? colors.background : color;
  return (
    <Tappable
      onPress={press}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        !filled && timed === undefined && { borderWidth: 1, borderColor: color },
        (pressed || busy) && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
          {timed !== undefined && <Text style={styles.timeLeft}>{timed}</Text>}
        </>
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
  buttonPressed: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  timed: { borderWidth: 2, borderRadius: 8, overflow: "hidden" },
  timeLeft: { fontSize: 12, color: colors.text, marginTop: 2 },
  info: {
    backgroundColor: "#E6F4FE",
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
