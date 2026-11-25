// Picking a poker table's look: a "Table decorations" section with one folding section per kind
// (colors, artistic, special), each a row of small table previews to tap. The one picked has a
// gold frame and a check. Special felts come in a few colors: tiny dots under the preview.
import { StyleSheet, Text, View } from "react-native";

import { POKER } from "@/components/amount-slider";
import { Foldable } from "@/components/controls";
import { Felt, SKIN_SECTIONS, skinById } from "@/components/poker-skins";
import { Tappable } from "@/components/tappable";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

// Small enough for three in a row.
const PREVIEW = { width: 70, height: 44 };

export function SkinPicker({ skin, onChange }: { skin: string; onChange: (skin: string) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <Foldable title={`Table decorations · ${skinById(skin).name}`}>
      {SKIN_SECTIONS.map((section) => (
        <Foldable
          key={section.title}
          title={section.title}
          // The section with the one picked starts open.
          startOpen={section.skins.some((s) => s.family.some((c) => c.id === skin))}
        >
          <View style={styles.grid}>
            {section.skins.map((option) => {
              // The color picked, if it's this one's; otherwise its first color.
              const shown = option.family.find((c) => c.id === skin) ?? option;
              const on = shown.id === skin;
              return (
                <View key={option.id} style={styles.option}>
                <Tappable
                  onPress={() => onChange(shown.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={shown.name}
                  style={styles.option}
                >
                  <View style={[styles.frame, on && styles.frameOn]}>
                    <Felt
                      skin={shown.id}
                      width={PREVIEW.width}
                      height={PREVIEW.height}
                      radius={PREVIEW.height / 2}
                      scale={0.36}
                    />
                  </View>
                  <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                    {on ? `✓ ${option.name}` : option.name}
                  </Text>
                </Tappable>
                {option.family.length > 1 && (
                  <View style={styles.dots}>
                    {option.family.map((color) => (
                      <Tappable
                        key={color.id}
                        onPress={() => onChange(color.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: color.id === skin }}
                        accessibilityLabel={color.name}
                        hitSlop={4}
                        style={[styles.dot, color.id === shown.id && styles.dotOn]}
                      >
                        <View style={[styles.dotFill, { backgroundColor: color.felt }]} />
                      </Tappable>
                    ))}
                  </View>
                )}
                </View>
              );
            })}
          </View>
        </Foldable>
      ))}
    </Foldable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    option: { alignItems: "center", gap: 4, width: PREVIEW.width + 6 },
    frame: {
      padding: 2,
      borderRadius: PREVIEW.height / 2 + 4,
      borderWidth: 2,
      borderColor: "transparent",
    },
    frameOn: { borderColor: POKER.gold[0] },
    name: { fontSize: 12, fontFamily: t.fonts.regular, color: t.colors.muted },
    nameOn: { fontFamily: t.fonts.bold, color: t.colors.text },
    // Five fit under a preview.
    dots: { flexDirection: "row", gap: 2 },
    // Tiny, with a ring round the one shown.
    dot: { padding: 1, borderRadius: 6, borderWidth: 1, borderColor: "transparent" },
    dotOn: { borderColor: POKER.gold[0] },
    dotFill: {
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
  });
