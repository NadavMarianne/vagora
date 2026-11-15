// Casino chips, seen a little from above. An amount is paid out in chip values, cheapest first:
// red, blue, green, orange, purple, gold (counted in small blinds), using as few chips as it can,
// so a big amount shows a few pricey chips. Shown as piles (one stack per color, side by side) or
// as a tower: one stack of thin chips in every color up to the amount's priciest, cheapest at the
// bottom and round again. When the amount changes, chips drop on or lift off.
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeOutUp, ZoomIn } from "react-native-reanimated";
import Svg, { Ellipse, Rect as SvgRect } from "react-native-svg";

/** Chip values in small blinds, priciest first: face color, edge (side and shade) color. All
 * bright colors, so no chip looks gray. */
const KINDS = [
  { worth: 2500, face: "#F2C230", edge: "#A07C12" },
  { worth: 500, face: "#8B3FD0", edge: "#55207F" },
  { worth: 100, face: "#F07F1E", edge: "#9A4A0B" },
  { worth: 25, face: "#22A05A", edge: "#11603A" },
  { worth: 5, face: "#2F6FE0", edge: "#173F8F" },
  { worth: 1, face: "#E04646", edge: "#8F2222" },
];

/** A tower's chips are thinner, so many colors fit in one small stack. */
const TOWER_THICK = 1.5;

/** A chip's size (width and thickness), and how many chips a stack can have. */
const SIZES = {
  small: { w: 11, thick: 2.4, most: 5 },
  medium: { w: 13, thick: 2.8, most: 6 },
};
type Size = keyof typeof SIZES;
type Kind = (typeof KINDS)[number];

/** The chips for an amount, priciest first: as few as it takes. */
function chipsFor(amount: number, smallBlind: number): Kind[] {
  let left = Math.max(0, Math.floor(amount / Math.max(1, smallBlind)));
  const chips: Kind[] = [];
  for (const kind of KINDS) {
    const count = Math.floor(left / kind.worth);
    left -= count * kind.worth;
    for (let i = 0; i < Math.min(count, 50); i++) chips.push(kind);
  }
  // Less than a small blind still shows one chip.
  if (chips.length === 0 && amount > 0) chips.push(KINDS[KINDS.length - 1]);
  return chips;
}

/** Piles: one stack per color, side by side, the biggest values first. */
function pilesFor(amount: number, smallBlind: number, most: number, stacks: number): Kind[][] {
  const result: Kind[][] = [];
  for (const chip of chipsFor(amount, smallBlind)) {
    const stack = result.find((s) => s[0] === chip);
    if (stack) {
      if (stack.length < most) stack.push(chip);
    } else if (result.length < stacks) {
      result.push([chip]);
    }
  }
  return result;
}

/** A tower: thin chips in every color up to the amount's priciest, cheapest at the bottom and
 * round again, taller the more there is. */
function towerFor(amount: number, smallBlind: number, levels: number): Kind[] {
  const blinds = Math.max(1, amount / Math.max(1, smallBlind));
  const count = Math.min(levels, 2 + Math.floor(Math.log2(blinds)));
  const priciest = chipsFor(amount, smallBlind)[0] ?? KINDS[KINDS.length - 1];
  const colors = KINDS.filter((kind) => kind.worth <= priciest.worth).reverse();
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
}

/** How big a pile of `stacks` stacks can get, so the space for it can be kept. */
export function pileSize(size: Size, stacks = 1) {
  const { w, thick, most } = SIZES[size];
  return { w: stacks * (w + 1), h: w * 0.6 + thick * most };
}

/** Chips for an amount: `piles` of one color each side by side, or one colorful `tower`. */
export function ChipStack({
  amount,
  smallBlind,
  size = "small",
  shape = "piles",
  stacks = 3,
  still = false,
  scale = 1,
}: {
  amount: number;
  smallBlind: number;
  size?: Size;
  shape?: "piles" | "tower";
  /** For piles: at most this many side by side. */
  stacks?: number;
  /** No chips dropping in or lifting off (for a pile that's moving as a whole). */
  still?: boolean;
  /** How many times their normal size the chips are drawn. */
  scale?: number;
}) {
  const { most, w: chipW, thick: chipThick } = SIZES[size];
  // A tower fits as many thin chips as a pile's height holds.
  const towerLevels = Math.floor((chipThick * most) / TOWER_THICK);
  const columns = useMemo(
    () =>
      shape === "tower"
        ? [towerFor(amount, smallBlind, towerLevels)]
        : pilesFor(amount, smallBlind, most, stacks),
    [amount, smallBlind, most, shape, stacks, towerLevels],
  );
  const h = pileSize(size).h * scale;
  const w = chipW * scale;
  const thick = (shape === "tower" ? TOWER_THICK : chipThick) * scale;
  return (
    <View style={[styles.pile, { height: h, gap: scale }]}>
      {columns.map((column, c) => (
        <View key={c} style={{ width: w, height: h }}>
          {column.map((kind, i) => (
            // Keyed by its place and color, so a new chip drops on top and a lost one lifts off.
            <Reanimated.View
              key={`${i}-${kind.worth}`}
              entering={still ? undefined : ZoomIn.duration(220).delay(i * 40)}
              exiting={still ? undefined : FadeOutUp.duration(220)}
              style={{ position: "absolute", left: -PAD * w, bottom: i * thick - PAD * w }}
            >
              <Chip face={kind.face} edge={kind.edge} w={w} thick={thick} />
            </Reanimated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Room drawn round each chip (a share of its width), so its edges are never cut off. */
const PAD = 0.1;

/** One chip seen a little from above: its side with white spots, its face with a dashed white
 * ring and a darker middle. */
function Chip({ face, edge, w, thick }: { face: string; edge: string; w: number; thick: number }) {
  const pad = PAD * w;
  const ry = w * 0.3;
  const cx = pad + w / 2;
  const top = pad + ry;
  return (
    <Svg width={w + 2 * pad} height={ry * 2 + thick + 2 * pad}>
      {/* The side. */}
      <Ellipse cx={cx} cy={top + thick} rx={w / 2} ry={ry} fill={edge} />
      <SvgRect x={pad} y={top} width={w} height={thick} fill={edge} />
      {[0.12, 0.44, 0.76].map((at) => (
        <SvgRect
          key={at}
          x={pad + w * at}
          y={top}
          width={w * 0.12}
          height={thick}
          fill="#FFFFFF"
          opacity={0.85}
        />
      ))}
      {/* The face. */}
      <Ellipse cx={cx} cy={top} rx={w / 2} ry={ry} fill={face} stroke={edge} strokeWidth={w * 0.04} />
      <Ellipse
        cx={cx}
        cy={top}
        rx={(w / 2) * 0.74}
        ry={ry * 0.74}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={w * 0.09}
        strokeDasharray={`${w * 0.16} ${w * 0.16}`}
        opacity={0.9}
      />
      <Ellipse cx={cx} cy={top} rx={(w / 2) * 0.42} ry={ry * 0.42} fill={edge} opacity={0.35} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pile: { flexDirection: "row", alignItems: "flex-end" },
});
