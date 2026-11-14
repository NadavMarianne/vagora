// Casino chips: tiny stacks seen a little from above, one stack per chip color, like a real pile.
// An amount is paid out in real chip values (white, red, green, black, purple, gold, counted in
// small blinds), biggest first, so more money means more and pricier chips. When the amount
// changes, chips drop onto the stacks or lift off them.
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeOutUp, ZoomIn } from "react-native-reanimated";
import Svg, { Ellipse, Rect as SvgRect } from "react-native-svg";

/** Chip values in small blinds, biggest first: face color, edge (side and shade) color. */
const KINDS = [
  { worth: 2500, face: "#F2C230", edge: "#A07C12" },
  { worth: 500, face: "#8B3FD0", edge: "#55207F" },
  { worth: 100, face: "#2E2E2E", edge: "#0B0B0B" },
  { worth: 25, face: "#22A05A", edge: "#11603A" },
  { worth: 5, face: "#E04646", edge: "#8F2222" },
  { worth: 1, face: "#F4F4F4", edge: "#9C9C9C" },
];

/** A chip's size: width, how thick it is, and how round its face looks from this angle. */
const SIZES = {
  small: { w: 11, thick: 2.4, most: 5, stacks: 2 },
  medium: { w: 12, thick: 2.6, most: 6, stacks: 3 },
  big: { w: 15, thick: 3, most: 8, stacks: 4 },
};
type Size = keyof typeof SIZES;

/** Stacks for an amount: how many chips of each color. It starts from the biggest value that
 * makes at least two chips (one lone chip looks like little), then pays out the rest. */
export function stacksFor(amount: number, smallBlind: number, size: Size) {
  const { most, stacks } = SIZES[size];
  let left = Math.max(0, Math.floor(amount / Math.max(1, smallBlind)));
  const first = KINDS.findIndex((kind) => left / kind.worth >= 2);
  const result: { kind: (typeof KINDS)[number]; count: number }[] = [];
  for (const kind of KINDS.slice(first === -1 ? 0 : first)) {
    const count = Math.floor(left / kind.worth);
    if (count > 0) {
      result.push({ kind, count: Math.min(most, count) });
      left -= count * kind.worth;
    }
    if (result.length === stacks) break;
  }
  // Less than a small blind still shows one white chip.
  if (result.length === 0 && amount > 0) result.push({ kind: KINDS[KINDS.length - 1], count: 1 });
  return result;
}

/** How big a pile can get, so the space for it can be kept. */
export function pileSize(size: Size) {
  const { w, thick, most, stacks } = SIZES[size];
  return { w: stacks * (w + 1), h: w * 0.6 + thick * most };
}

/** Tiny chip stacks for an amount, side by side. */
export function ChipStack({
  amount,
  smallBlind,
  size = "small",
}: {
  amount: number;
  smallBlind: number;
  size?: Size;
}) {
  const stacks = useMemo(() => stacksFor(amount, smallBlind, size), [amount, smallBlind, size]);
  const { h } = pileSize(size);
  return (
    <View style={[styles.pile, { height: h }]}>
      {stacks.map(({ kind, count }) => (
        <View key={kind.worth} style={{ width: SIZES[size].w, height: h }}>
          {Array.from({ length: count }, (_, i) => (
            // Keyed by color and height, so a new chip drops on top and a lost one lifts off.
            <Reanimated.View
              key={i}
              entering={ZoomIn.duration(220).delay(i * 40)}
              exiting={FadeOutUp.duration(220)}
              style={{ position: "absolute", bottom: i * SIZES[size].thick }}
            >
              <Chip face={kind.face} edge={kind.edge} size={size} />
            </Reanimated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** One chip seen a little from above: its side with white spots, its face with a dashed white
 * ring and a darker middle. */
function Chip({ face, edge, size }: { face: string; edge: string; size: Size }) {
  const { w, thick } = SIZES[size];
  const ry = w * 0.3;
  const h = ry * 2 + thick;
  const cx = w / 2;
  const top = ry;
  return (
    <Svg width={w} height={h}>
      {/* The side. */}
      <Ellipse cx={cx} cy={top + thick} rx={cx} ry={ry} fill={edge} />
      <SvgRect x={0} y={top} width={w} height={thick} fill={edge} />
      {[0.12, 0.44, 0.76].map((at) => (
        <SvgRect key={at} x={w * at} y={top} width={w * 0.12} height={thick} fill="#FFFFFF" opacity={0.85} />
      ))}
      {/* The face. */}
      <Ellipse cx={cx} cy={top} rx={cx} ry={ry} fill={face} stroke={edge} strokeWidth={0.4} />
      <Ellipse
        cx={cx}
        cy={top}
        rx={cx * 0.74}
        ry={ry * 0.74}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={w * 0.09}
        strokeDasharray={`${w * 0.16} ${w * 0.16}`}
        opacity={0.9}
      />
      <Ellipse cx={cx} cy={top} rx={cx * 0.42} ry={ry * 0.42} fill={edge} opacity={0.35} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pile: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
});
