// Casino chips: tiny stacks of mixed colors, seen a little from above, like a real pile. An
// amount is paid out in chip values (blue, red, green, orange, purple, gold, counted in small
// blinds), biggest first, so more money means more and pricier chips. When the amount changes,
// chips drop onto the stacks or lift off them.
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeOutUp, ZoomIn } from "react-native-reanimated";
import Svg, { Ellipse, Rect as SvgRect } from "react-native-svg";

/** Chip values in small blinds, biggest first: face color, edge (side and shade) color. All
 * bright colors, so no chip looks gray. */
const KINDS = [
  { worth: 2500, face: "#F2C230", edge: "#A07C12" },
  { worth: 500, face: "#8B3FD0", edge: "#55207F" },
  { worth: 100, face: "#F07F1E", edge: "#9A4A0B" },
  { worth: 25, face: "#22A05A", edge: "#11603A" },
  { worth: 5, face: "#E04646", edge: "#8F2222" },
  { worth: 1, face: "#2F6FE0", edge: "#173F8F" },
];

/** A chip's size (width and thickness), and how many stacks of how many chips a pile can have. */
const SIZES = {
  small: { w: 11, thick: 2.4, most: 5, stacks: 2 },
  medium: { w: 13, thick: 2.8, most: 6, stacks: 3 },
};
type Size = keyof typeof SIZES;
type Kind = (typeof KINDS)[number];

/** The chips for an amount, biggest values first. It starts from the biggest value that makes at
 * least two chips (one lone chip looks like little), then pays out the rest. */
function chipsFor(amount: number, smallBlind: number, size: Size): Kind[] {
  const { most, stacks } = SIZES[size];
  let left = Math.max(0, Math.floor(amount / Math.max(1, smallBlind)));
  const first = KINDS.findIndex((kind) => left / kind.worth >= 2);
  const chips: Kind[] = [];
  for (const kind of KINDS.slice(first === -1 ? 0 : first)) {
    const count = Math.floor(left / kind.worth);
    left -= count * kind.worth;
    for (let i = 0; i < count && chips.length < most * stacks; i++) chips.push(kind);
  }
  // Less than a small blind still shows one chip.
  if (chips.length === 0 && amount > 0) chips.push(KINDS[KINDS.length - 1]);
  return chips;
}

/** The chips dealt round into stacks (about three chips a stack before starting another), so
 * every stack mixes colors, the biggest values at the bottom. */
export function stacksFor(amount: number, smallBlind: number, size: Size): Kind[][] {
  const chips = chipsFor(amount, smallBlind, size);
  const count = Math.min(SIZES[size].stacks, Math.max(1, Math.ceil(chips.length / 3)));
  const stacks: Kind[][] = Array.from({ length: count }, () => []);
  chips.forEach((chip, i) => stacks[i % count].push(chip));
  return stacks;
}

/** How big a pile can get, so the space for it can be kept. */
export function pileSize(size: Size) {
  const { w, thick, most, stacks } = SIZES[size];
  return { w: stacks * (w + 1), h: w * 0.6 + thick * most };
}

/** Tiny stacks of chips for an amount, side by side. */
export function ChipStack({
  amount,
  smallBlind,
  size = "small",
  still = false,
  scale = 1,
}: {
  amount: number;
  smallBlind: number;
  size?: Size;
  /** How many times their normal size the chips are drawn. */
  scale?: number;
  /** No chips dropping in or lifting off (for a pile that's moving as a whole). */
  still?: boolean;
}) {
  const stacks = useMemo(() => stacksFor(amount, smallBlind, size), [amount, smallBlind, size]);
  const h = pileSize(size).h * scale;
  const w = SIZES[size].w * scale;
  const thick = SIZES[size].thick * scale;
  return (
    <View style={[styles.pile, { height: h }]}>
      {stacks.map((stack, s) => (
        <View key={s} style={{ width: w, height: h }}>
          {stack.map((kind, i) => (
            // Keyed by its place and color, so a new chip drops on top and a lost one lifts off.
            <Reanimated.View
              key={`${i}-${kind.worth}`}
              entering={still ? undefined : ZoomIn.duration(220).delay(i * 40)}
              exiting={still ? undefined : FadeOutUp.duration(220)}
              style={{ position: "absolute", bottom: i * thick }}
            >
              <Chip face={kind.face} edge={kind.edge} w={w} thick={thick} />
            </Reanimated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** One chip seen a little from above: its side with white spots, its face with a dashed white
 * ring and a darker middle. */
function Chip({ face, edge, w, thick }: { face: string; edge: string; w: number; thick: number }) {
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
