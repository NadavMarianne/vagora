import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Body, Button, colors, ErrorText, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { LedgerEntry, Market, Member } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type MarketPage = { market: Market; entries: LedgerEntry[]; members: Member[] };

export default function MarketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(
    useCallback(async (): Promise<MarketPage> => {
      // The market first: opening it pays any allowance that came due.
      const market = await api<Market>(`/markets/${id}`);
      const [entries, members] = await Promise.all([
        api<LedgerEntry[]>(`/markets/${id}/ledger`),
        api<Member[]>(`/markets/${id}/members`),
      ]);
      return { market, entries, members };
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
  const { market, entries, members } = data;

  return (
    <Screen>
      <Stack.Screen options={{ title: market.name }} />
      <View style={styles.balanceBox}>
        <Text style={styles.balanceLabel}>Your balance</Text>
        <Text style={styles.balance}>
          {market.my_balance.toLocaleString()} {market.currency_name}
        </Text>
      </View>

      <Text style={styles.heading}>Recent transactions</Text>
      {entries.length === 0 && <Body>Nothing yet.</Body>}
      {entries.map((entry, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.note}>{entry.note}</Text>
            <Text style={styles.date}>{new Date(entry.created_at).toLocaleString()}</Text>
          </View>
          <Text style={[styles.amount, entry.amount < 0 && styles.negative]}>
            {entry.amount > 0 ? "+" : ""}
            {entry.amount.toLocaleString()}
          </Text>
        </View>
      ))}

      <Text style={styles.heading}>Members</Text>
      {members.map((member) => (
        <Body key={member.username}>
          {member.display_name} (@{member.username})
        </Body>
      ))}

      <Button
        title="Settings"
        kind="secondary"
        onPress={() => router.push(`/markets/${id}/settings`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceBox: { backgroundColor: "#E6F4FE", borderRadius: 12, padding: 20, gap: 4 },
  balanceLabel: { fontSize: 14, color: colors.muted },
  balance: { fontSize: 30, fontWeight: "700", color: colors.text },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flexShrink: 1, gap: 2 },
  note: { fontSize: 16, color: colors.text },
  date: { fontSize: 13, color: colors.muted },
  amount: { fontSize: 16, fontWeight: "600", color: "#2E7D32" },
  negative: { color: colors.error },
});
