// Picking a poker table's look: a "Table decorations" section with one folding section per kind
// (colors, artistic, special), each a row of small table previews to tap. The one picked has a
// gold frame and a check.
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
          startOpen={section.skins.some((s) => s.id === skin)}
        >
          <View style={styles.grid}>
            {section.skins.map((option) => {
              const on = option.id === skin;
              return (
                <Tappable
                  key={option.id}
                  onPress={() => onChange(option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={option.name}
                  style={styles.option}
                >
                  <View style={[styles.frame, on && styles.frameOn]}>
                    <Felt
                      skin={option.id}
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
  });
