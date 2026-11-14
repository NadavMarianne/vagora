// Casino chips, seen from the side and stacked. More chips the more there is: about one more each
// time the amount doubles. Their colors come from real chip values (white, red, green, black,
// purple, gold), counted in small blinds.
import { StyleSheet, View } from "react-native";

const CHIP_W = 24;
const CHIP_H = 7;
// How much of each chip shows above the one under it.
const LAYER = 4;
const PER_COLUMN = 6;

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
function chipsFor(amount: number, smallBlind: number) {
  const blinds = Math.max(1, amount / Math.max(1, smallBlind));
  const count = Math.min(PER_COLUMN * 3, 1 + Math.floor(Math.log2(blinds) * 1.3));
  // Pay the amount out in real chip values, biggest first.
  const kinds: (typeof KINDS)[number][] = [];
  let left = blinds;
  for (const kind of KINDS) {
    while (left >= kind.worth && kinds.length < count) {
      kinds.push(kind);
      left -= kind.worth;
    }
  }
  // Fewer real chips than the count: fill up with the smallest one used.
  while (kinds.length < count) kinds.push(kinds.at(-1) ?? KINDS.at(-1)!);
  return kinds;
}

/** A pile of chips for an amount: up to three stacks side by side. */
export function ChipStack({ amount, smallBlind }: { amount: number; smallBlind: number }) {
  const chips = chipsFor(amount, smallBlind);
  const columns: (typeof chips)[] = [];
  chips.forEach((chip, i) => {
    const column = Math.floor(i / PER_COLUMN);
    (columns[column] ??= []).push(chip);
  });
  return (
    <View style={styles.pile}>
      {columns.map((column, c) => (
        <View
          key={c}
          style={[styles.column, { height: CHIP_H + LAYER * (PER_COLUMN - 1), marginTop: c * 3 }]}
        >
          {column.map((chip, i) => (
            <View
              key={i}
              style={[
                styles.chip,
                { bottom: i * LAYER, backgroundColor: chip.color, borderColor: chip.edge },
              ]}
            >
              {/* The white stripes around a chip's edge. */}
              <View style={[styles.stripe, { left: 3 }]} />
              <View style={[styles.stripe, { left: CHIP_W / 2 - 2.5 }]} />
              <View style={[styles.stripe, { right: 3 }]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pile: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
  column: { width: CHIP_W, justifyContent: "flex-end" },
  chip: {
    position: "absolute",
    left: 0,
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: CHIP_H / 2,
    borderWidth: 1,
    boxShadow: "0 1px 1px rgba(0,0,0,0.4)",
  },
  stripe: {
    position: "absolute",
    top: 0.5,
    width: 3,
    height: CHIP_H - 3,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
});
