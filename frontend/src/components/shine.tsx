// A metallic gold finish for a button: a gold gradient, a wave of light that glides across it
// every couple of seconds, and a few tiny sparkles that twinkle. It sits behind the button's
// text and doesn't take taps.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** The gold, from its shadow to its highlight. */
export const GOLD = { deep: "#8A6510", base: "#C9A227", light: "#F1D77E" };

/** Where the sparkles sit (shares of the button's width and height) and when each twinkles. */
const SPARKLES = [
  { x: 0.14, y: 0.3, delay: 0, size: 7 },
  { x: 0.84, y: 0.66, delay: 700, size: 6 },
  { x: 0.62, y: 0.22, delay: 1400, size: 5 },
];

export function GoldShine() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [wave] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const glide = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1600),
        Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    glide.start();
    return () => glide.stop();
  }, [wave]);

  const { width, height } = size;
  const shift = wave.interpolate({ inputRange: [0, 1], outputRange: [-60, width + 60] });
  return (
    <View
      style={styles.fill}
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={GOLD.light} />
                <Stop offset="0.45" stopColor={GOLD.base} />
                <Stop offset="1" stopColor={GOLD.deep} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill="url(#gold)" />
          </Svg>
          {/* The wave of light, slanted, gliding from left to right. */}
          <Animated.View
            style={[
              styles.wave,
              { height: height * 2, top: -height / 2 },
              { transform: [{ translateX: shift }, { rotate: "22deg" }] },
            ]}
          />
          {SPARKLES.map((s) => (
            <Sparkle key={s.delay} x={s.x * width} y={s.y * height} size={s.size} delay={s.delay} />
          ))}
        </>
      )}
    </View>
  );
}

/** A tiny four-pointed star that grows, glows and fades, again and again. */
function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const [glow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const twinkle = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(glow, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.delay(2100 - delay),
      ]),
    );
    twinkle.start();
    return () => twinkle.stop();
  }, [glow, delay]);
  const half = size / 2;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - half,
        top: y - half,
        opacity: glow,
        transform: [{ scale: glow }],
      }}
    >
      <Svg width={size} height={size}>
        <Path
          d={`M${half} 0 Q${half} ${half} ${size} ${half} Q${half} ${half} ${half} ${size} Q${half} ${half} 0 ${half} Q${half} ${half} ${half} 0 Z`}
          fill="#FFFFFF"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" },
  wave: {
    position: "absolute",
    left: 0,
    width: 26,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});
