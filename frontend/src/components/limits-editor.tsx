// Edits a limits file: one line per thing that's never allowed (decision 0022).
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Button, colors, useRevealFocused } from "@/components/ui";

/** Lines being edited carry a key, so each keeps its place while others are added or removed. */
export type DraftLine = { key: string; text: string };

let nextKey = 0;
export const toDraft = (lines: string[]): DraftLine[] =>
  lines.map((text) => ({ key: String(nextKey++), text }));

/** The lines as they'll be saved: trimmed, without empty ones or repeats. */
export function cleanLines(draft: DraftLine[]): string[] {
  return [...new Set(draft.map((l) => l.text.trim()).filter(Boolean))];
}

/** Whether saving `draft` over `saved` adds or changes anything, which may cost coins.
 * Only removing lines is always free. */
export function addsSomething(saved: string[], draft: DraftLine[]): boolean {
  return cleanLines(draft).some((line) => !saved.includes(line));
}

export function LimitsEditor({
  value,
  onChange,
}: {
  value: DraftLine[];
  onChange: (value: DraftLine[]) => void;
}) {
  const reveal = useRevealFocused();
  return (
    <View style={styles.editor}>
      {value.map((line, index) => (
        <View key={line.key} style={styles.row}>
          <Text style={styles.number}>{index + 1}.</Text>
          <TextInput
            style={styles.input}
            value={line.text}
            onChangeText={(text) =>
              onChange(value.map((l) => (l.key === line.key ? { ...l, text } : l)))
            }
            onFocus={reveal}
            maxLength={100}
            placeholder="Something that’s never allowed for you"
            placeholderTextColor={colors.muted}
          />
          <Tappable
            onPress={() => onChange(value.filter((l) => l.key !== line.key))}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel="Remove this line"
          >
            <Text style={styles.removeText}>✕</Text>
          </Tappable>
        </View>
      ))}
      <Button
        title="+ Add a line"
        kind="secondary"
        onPress={() => onChange([...value, ...toDraft([""])])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { fontSize: 15, color: colors.muted, width: 24 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  remove: { padding: 8 },
  removeText: { fontSize: 18, color: colors.muted },
});
