// Casino chips, seen from the side and stacked in one pile. More chips the more there is: one more
// each time the amount doubles (a little slower in a small pile), up to the most a pile holds.
// Their colors come from real chip values (white, red, green, black, purple, gold), counted in
// small blinds.
import { StyleSheet, View } from "react-native";

const CHIP_W = 20;
const CHIP_H = 7;
/** A small pile fits in a bet's pill; a big one is the pot. `layer` is how much of each chip
 * shows above the one under it, `doublings` how many times the amount doubles per extra chip. */
const PILES = {
  small: { most: 5, layer: 2.5, doublings: 1.5 },
  big: { most: 10, layer: 3, doublings: 1 },
};

/** Chip values in small blinds, biggest first, with each one's color and edge. */
const KINDS = [
  { worth: 2500, color: "#E8B923", edge: "#9C7A10" },
  { worth: 500, color: "#7B2FBE", edge: "#4A1A75" },
  { worth: 100, color: "#232323", edge: "#000000" },
  { worth: 25, color: "#1F8A4C", edge: "#0F5730" },
  { worth: 5, color: "#D23B3B", edge: "#8A1E1E" },
  { worth: 1, color: "#F2F2F2", edge: "#A8A8A8" },
];

/** The chips for an amount: how many grows with the amount, colors from the biggest values in it. */
function chipsFor(amount: number, smallBlind: number, most: number, doublings: number) {
  const blinds = Math.max(1, amount / Math.max(1, smallBlind));
  const count = Math.min(most, 1 + Math.floor(Math.log2(blinds) / doublings));
  // Pay the amount out in real chip values, biggest first (at the bottom of the pile).
  const kinds: (typeof KINDS)[number][] = [];
  let left = blinds;
  for (const kind of KINDS) {
    while (left >= kind.worth && kinds.length < count) {
      kinds.push(kind);
      left -= kind.worth;
    }
  }
  // Fewer real chips than the count: fill up with the smallest one used.
  while (kinds.length < count) kinds.push(kinds[kinds.length - 1] ?? KINDS[KINDS.length - 1]);
  return kinds;
}

/** The tallest a pile gets. */
export function pileHeight(size: keyof typeof PILES) {
  return CHIP_H + PILES[size].layer * (PILES[size].most - 1);
}

/** A pile of chips for an amount. */
export function ChipStack({
  amount,
  smallBlind,
  size = "small",
}: {
  amount: number;
  smallBlind: number;
  size?: keyof typeof PILES;
}) {
  const { most, layer, doublings } = PILES[size];
  const chips = chipsFor(amount, smallBlind, most, doublings);
  return (
    <View style={[styles.pile, { height: CHIP_H + layer * (chips.length - 1) }]}>
      {chips.map((chip, i) => (
        <View
          key={i}
          style={[
            styles.chip,
            { bottom: i * layer, backgroundColor: chip.color, borderColor: chip.edge },
          ]}
        >
          {/* The white stripes around a chip's edge. */}
          <View style={[styles.stripe, { left: 2 }]} />
          <View style={[styles.stripe, { left: CHIP_W / 2 - 2.5 }]} />
          <View style={[styles.stripe, { right: 2 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pile: { width: CHIP_W },
  chip: {
    position: "absolute",
    left: 0,
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: CHIP_H / 2,
    borderWidth: 1,
    overflow: "hidden",
  },
  stripe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
});
