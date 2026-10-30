// Picking a market's time zone from a searchable list, like "Jerusalem · Asia (GMT+2)".
// The list comes from the backend, so every choice is one the backend accepts.
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, colors, ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import type { TimeZone } from "@/lib/types";

let cached: TimeZone[] | null = null;

function describe(zone: TimeZone) {
  return `${zone.city} · ${zone.region} (${zone.offset})`;
}

export function TimeZonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [zones, setZones] = useState<TimeZone[] | null>(cached);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cached) return;
    api<TimeZone[]>("/time-zones")
      .then((list) => {
        cached = list;
        setZones(list);
      })
      .catch(() => setError("Couldn't load the list of time zones."));
  }, []);

  const current = zones?.find((zone) => zone.id === value);
  const matches = useMemo(() => {
    const words = search.toLowerCase().trim();
    if (!zones || !words) return zones ?? [];
    return zones.filter((zone) =>
      `${zone.city} ${zone.region} ${zone.id} ${zone.offset}`.toLowerCase().includes(words),
    );
  }, [zones, search]);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Time zone</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.current} accessibilityRole="button">
        <Text style={styles.currentText}>{current ? describe(current) : value}</Text>
        <Text style={styles.change}>Change</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <TextInput
            style={styles.search}
            placeholder="Search a city, like Jerusalem"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={matches}
            keyExtractor={(zone) => zone.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, item.id === value && styles.rowOn]}
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Text style={styles.rowText}>{describe(item)}</Text>
              </Pressable>
            )}
          />
          <Button title="Cancel" kind="secondary" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  current: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  currentText: { fontSize: 16, color: colors.text, flexShrink: 1 },
  change: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  modal: { flex: 1, padding: 24, paddingTop: 60, gap: 12, backgroundColor: colors.background },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowOn: { backgroundColor: "#E6F4FE" },
  rowText: { fontSize: 16, color: colors.text },
});
