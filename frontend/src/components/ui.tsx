// Plain building blocks shared by the screens, drawn in the theme the person picked
// (src/lib/themes.ts).
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
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { FoldRegistry } from "@/components/folds";
import { Tappable } from "@/components/tappable";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

/** How important a notification is (backend/app/signals.py). */
export type Level = "info" | "good" | "warning" | "critical";

/** The color pattern for notifications: red critical, orange warning, green good, and the
 * theme's own color for the rest. Returns the color and the text color on top of it. */
export function levelColors(t: Theme, level: Level): [string, string] {
  const c = t.colors;
  if (level === "critical") return [c.bad, c.onBad];
  if (level === "warning") return [c.warning, c.onWarning];
  if (level === "good") return [c.good, c.onGood];
  return [c.info, c.onInfo];
}

/** Puts levels in order, so the most important of several can be picked. */
export const LEVEL_RANK: Record<Level, number> = { info: 0, good: 1, warning: 2, critical: 3 };

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
  const styles = useStyles(makeStyles);
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
  const styles = useStyles(makeStyles);
  return <Text style={styles.title}>{children}</Text>;
}

/** A section's heading inside a page, like "Recent transactions". */
export function Heading({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.body}>{children}</Text>;
}

/** Quieter small text, like dates. */
export function Small({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.small}>{children}</Text>;
}

/** A card: a raised box on the page, in the theme's shape. */
export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({ label, onFocus, ...input }: { label: string } & TextInputProps) {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const reveal = useRevealFocused();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={t.colors.muted}
        onFocus={(event) => {
          onFocus?.(event);
          reveal();
        }}
        {...input}
      />
    </View>
  );
}

/** "2h 5m left" until a moment, kept up to date every second. */
export function TimeLeft({ until, style }: { until: string; style?: StyleProp<TextStyle> }) {
  const now = useNow();
  return <Text style={style}>{timeLeft(Date.parse(until) - now)}</Text>;
}

/** A highlighted explanation: what a page is for, or what happens next. */
export function Info({ title, children }: { title?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.info}>
      {title && <Text style={styles.infoTitle}>{title}</Text>}
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

type ButtonKind = "primary" | "secondary" | "good" | "bad";

/** A button's color, and the color of text on top of it. */
function buttonColors(t: Theme, kind: ButtonKind): [string, string] {
  const c = t.colors;
  if (kind === "good") return [c.good, c.onGood];
  if (kind === "bad") return [c.bad, c.onBad];
  if (kind === "secondary") return [c.outline, c.outlineText];
  return [c.primary, c.onPrimary];
}

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

// How long each step of a time bar's drain lasts. Short enough for the phone to plan easily.
const DRAIN_STEP_MS = 30_000;

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
 * time between `from` and `until` runs out. Where it's filled, the title takes the color that
 * reads on it. */
export function TimedButton({
  from,
  until,
  kind = "primary",
  ...button
}: ButtonProps & { from: string; until: string }) {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const now = useNow();
  const start = Date.parse(from);
  const end = Date.parse(until);
  const [color, onColor] = buttonColors(t, kind === "secondary" ? "primary" : kind);
  const [width, setWidth] = useState(0);
  // 1 when the time starts, 0 when it's up.
  const [progress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const share = (at: number) =>
      end > start ? Math.min(1, Math.max(0, (end - at) / (end - start))) : 0;
    progress.setValue(share(Date.now()));
    // A steady drain, run by the phone's animation system in short steps. The phone works out
    // every frame of a step in advance, so one step lasting days would freeze and crash the app.
    let step: Animated.CompositeAnimation | null = null;
    function next() {
      const at = Date.now();
      if (at >= end) return;
      const stepEnd = Math.min(end, at + DRAIN_STEP_MS);
      step = Animated.timing(progress, {
        toValue: share(stepEnd),
        duration: stepEnd - at,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      step.start(({ finished }) => finished && next());
    }
    next();
    return () => step?.stop();
  }, [progress, start, end]);

  // The colored layer slides left as time runs out; its title slides back so it stays put.
  const fillShift = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const titleShift = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const left = timeLeft(end - now);
  const title = t.upperButtons ? button.title.toUpperCase() : button.title;

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
          styles.timedFill,
          { backgroundColor: color, transform: [{ translateX: fillShift }] },
        ]}
      >
        <Animated.View style={[styles.button, { transform: [{ translateX: titleShift }] }]}>
          <Text style={[styles.buttonText, { color: onColor }]}>{title}</Text>
          <Text style={[styles.timeLeft, { color: onColor }]}>{left}</Text>
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
  const styles = useStyles(makeStyles);
  const t = useTheme();
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

  const outlined = kind === "secondary";
  const [color, onColor] = buttonColors(t, kind);
  // A timed button's color is drawn behind it as a time bar, so the button itself is clear.
  const background = timed !== undefined ? "transparent" : outlined ? t.colors.surface : color;
  const textColor = timed !== undefined ? t.colors.text : onColor;
  return (
    <Tappable
      onPress={press}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        timed === undefined && styles.buttonShadow,
        { backgroundColor: background },
        outlined && timed === undefined && { borderWidth: t.borderWidth, borderColor: color },
        (pressed || busy) && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: textColor }]}>
            {t.upperButtons ? title.toUpperCase() : title}
          </Text>
          {timed !== undefined && <Text style={styles.timeLeft}>{timed}</Text>}
        </>
      )}
    </Tappable>
  );
}

export function Loading() {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={t.colors.primary} />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    screenContent: { padding: 20, gap: 16 },
    title: {
      fontSize: 28,
      fontFamily: t.fonts.heading,
      color: t.colors.text,
      textTransform: t.upperTitles ? "uppercase" : "none",
    },
    heading: {
      fontSize: 19,
      fontFamily: t.fonts.heading,
      color: t.colors.text,
      marginTop: 8,
      textTransform: t.upperTitles ? "uppercase" : "none",
    },
    body: { fontSize: 16, fontFamily: t.fonts.regular, color: t.colors.text, lineHeight: 22 },
    small: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    card: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderWidth: t.borderWidth,
      borderRadius: t.radius.card,
      padding: 16,
      gap: 10,
      boxShadow: t.shadow.card || undefined,
    },
    field: { gap: 6 },
    label: { fontSize: 14, fontFamily: t.fonts.bold, color: t.colors.text },
    input: {
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius.button,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: t.fonts.regular,
      color: t.colors.text,
    },
    error: { color: t.colors.error, fontSize: 15, fontFamily: t.fonts.bold },
    button: { borderRadius: t.radius.button, paddingVertical: 14, alignItems: "center" },
    buttonShadow: { boxShadow: t.shadow.button || undefined },
    buttonPressed: { opacity: 0.7 },
    buttonText: { fontSize: 16, fontFamily: t.fonts.bold, letterSpacing: t.upperButtons ? 1 : 0 },
    timed: {
      borderWidth: Math.max(2, t.borderWidth),
      borderRadius: t.radius.button,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
    },
    // Clips the light title to the colored part, so the rest of the title stays dark.
    timedFill: { overflow: "hidden" },
    timeLeft: { fontSize: 12, fontFamily: t.fonts.regular, color: t.colors.text, marginTop: 2 },
    info: {
      backgroundColor: t.colors.note,
      borderLeftWidth: 4,
      borderLeftColor: t.colors.primary,
      borderRadius: Math.min(t.radius.card, 10),
      padding: 12,
      gap: 4,
    },
    infoTitle: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.noteText },
    infoText: {
      fontSize: 15,
      fontFamily: t.fonts.regular,
      color: t.colors.noteText,
      lineHeight: 21,
    },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.background,
    },
  });
