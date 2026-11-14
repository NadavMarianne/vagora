// The market's Games section: its poker tables (decision 0030).
import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, ErrorText, Info, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { Market, PokerTable } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import type { Theme } from "@/lib/themes";
import { useStyles } from "@/lib/theme";

export default function GamesScreen() {
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(
    useCallback(async () => {
      const [market, tables] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<PokerTable[]>(`/markets/${id}/tables`),
      ]);
      return { market, tables };
    }, [id]),
  );

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }
  const { market, tables } = data;

  return (
    <Screen>
      <Info title="Poker with real cards">
        Deal real cards, and let the app be the chips. Sit down with {market.currency_name} from
        your balance, bet on your phone, and get up with whatever you have left.
      </Info>

      {tables.length === 0 && <Body>No tables yet. Open the first one.</Body>}
      {tables.map((table) => {
        const playing = table.hand !== null && table.hand.street !== "done";
        return (
          <Tappable
            key={table.id}
            style={styles.row}
            accessibilityRole="button"
            onPress={() => router.push(`/markets/${id}/games/${table.id}`)}
          >
            <View style={styles.rowText}>
              <Text style={styles.name}>{table.name}</Text>
              <Text style={styles.small}>
                Blinds {table.small_blind}/{table.big_blind} · {table.seats.length}/
                {table.max_players} players
                {playing ? " · playing" : ""}
              </Text>
            </View>
            {table.my_seat !== null && <Text style={styles.you}>You’re here</Text>}
          </Tappable>
        );
      })}

      <Button title="Open a table" onPress={() => router.push(`/markets/${id}/games/new`)} />
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: t.radius.card,
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    rowText: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text },
    small: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    you: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.primary },
  });
