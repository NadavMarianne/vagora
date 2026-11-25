// Picking a poker table's look: a "Table decorations" section with one folding section per kind
// (colors, artistic, special), each a row of small table previews to tap. The one picked has a
// gold frame and a check. Special felts come in a few colors: tapping one opens a small menu of
// its colors, in the same order as the plain colors (see TONES).
import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

import { POKER } from "@/components/amount-slider";
import { Foldable } from "@/components/controls";
import { Felt, SKIN_SECTIONS, type Skin, skinById } from "@/components/poker-skins";
import { Tappable } from "@/components/tappable";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

// Small enough for three in a row.
const PREVIEW = { width: 70, height: 44 };

/** A special felt's own name, without its color ("Suits", not "Suits · Blue"). */
const plainName = (skin: Skin) => skin.name.split(" · ")[0];

export function SkinPicker({ skin, onChange }: { skin: string; onChange: (skin: string) => void }) {
  const styles = useStyles(makeStyles);
  // The special felt whose colors are being picked from.
  const [colorsOf, setColorsOf] = useState<Skin | null>(null);
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
              // The color picked, if it's one of this felt's; otherwise the felt as it comes.
              const shown = option.family.find((c) => c.id === skin) ?? option;
              const on = shown.id === skin;
              const colors = option.family.length > 1;
              return (
                <Tappable
                  key={option.id}
                  onPress={() => (colors ? setColorsOf(option) : onChange(option.id))}
                  accessibilityRole={colors ? "button" : "radio"}
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={colors ? `${plainName(option)}, pick a color` : option.name}
                  style={styles.option}
                >
                  <Preview id={shown.id} on={on} />
                  <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                    {on ? `✓ ${plainName(shown)}` : plainName(shown)}
                  </Text>
                  {colors && (
                    <Text style={styles.colorsHint} numberOfLines={1}>
                      {on ? shown.toneName : `${option.family.length} colors`} ▾
                    </Text>
                  )}
                </Tappable>
              );
            })}
          </View>
        </Foldable>
      ))}
      <Modal
        visible={colorsOf !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setColorsOf(null)}
      >
        {/* Tapping round the menu closes it. */}
        <Tappable style={styles.backdrop} onPress={() => setColorsOf(null)}>
          <Tappable style={styles.menu} onPress={() => {}}>
            {colorsOf && <Text style={styles.menuTitle}>{plainName(colorsOf)}</Text>}
            <View style={styles.grid}>
              {colorsOf?.family.map((color) => {
                const on = color.id === skin;
                return (
                  <Tappable
                    key={color.id}
                    onPress={() => {
                      onChange(color.id);
                      setColorsOf(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={color.name}
                    style={styles.option}
                  >
                    <Preview id={color.id} on={on} />
                    <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                      {on ? `✓ ${color.toneName}` : color.toneName}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          </Tappable>
        </Tappable>
      </Modal>
    </Foldable>
  );
}

/** A small table in a skin, with a gold frame when it's the one picked. */
function Preview({ id, on }: { id: string; on: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.frame, on && styles.frameOn]}>
      <Felt
        skin={id}
        width={PREVIEW.width}
        height={PREVIEW.height}
        radius={PREVIEW.height / 2}
        scale={0.36}
      />
    </View>
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
    colorsHint: { fontSize: 11, fontFamily: t.fonts.regular, color: t.colors.muted },
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    // Three previews to a row.
    menu: {
      width: 3 * (PREVIEW.width + 6) + 2 * 8 + 2 * 16 + 4,
      maxWidth: "100%",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    menuTitle: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text },
  });
