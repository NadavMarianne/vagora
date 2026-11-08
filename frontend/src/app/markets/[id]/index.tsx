import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Body, Button, ErrorText, Heading, Info, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { LedgerEntry, Market, MyProposal, Order } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type MarketPage = {
  market: Market;
  entries: LedgerEntry[];
  proposals: MyProposal[];
  orders: Order[];
};

export default function MarketScreen() {
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  // How many transactions show: the 5 newest, then 10 more each time.
  const [shown, setShown] = useState(5);
  const { data, error } = useLoad(
    useCallback(async (): Promise<MarketPage> => {
      // The market first: opening it pays any allowance that came due.
      const market = await api<Market>(`/markets/${id}`);
      const [entries, proposals, orders] = await Promise.all([
        api<LedgerEntry[]>(`/markets/${id}/ledger?limit=100`),
        api<MyProposal[]>(`/markets/${id}/proposals`),
        api<Order[]>(`/markets/${id}/orders`),
      ]);
      return { market, entries, proposals, orders };
    }, [id]),
  );

  // A new member sets their limits before anything else (decision 0022).
  const needsLimits = data?.market.my_limits_set === false;
  useEffect(() => {
    if (needsLimits) router.replace(`/markets/${id}/limits-setup`);
  }, [needsLimits, id]);

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }
  const { market, entries, proposals, orders } = data;
  // Orders waiting for you: to deliver as a seller, or to confirm as a buyer.
  const waiting = orders.filter(
    (o) =>
      (o.role === "seller" &&
        ["open", "new_deadline_asked", "cancel_pending"].includes(o.status)) ||
      (o.role === "buyer" && ["done_claimed", "missed"].includes(o.status)),
  ).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: market.name }} />
      <View style={styles.balanceBox}>
        <Text style={styles.balanceLabel}>Your balance</Text>
        <Text style={styles.balance}>
          {market.my_balance.toLocaleString()}{" "}
          <Text style={styles.currency}>{market.currency_name}</Text>
        </Text>
      </View>

      <View style={styles.buttons}>
        <View style={styles.half}>
          <Button title="Store" onPress={() => router.push(`/markets/${id}/store`)} />
        </View>
        <View style={styles.half}>
          <Button
            title={waiting > 0 ? `Orders · ${waiting}` : "Orders"}
            kind="secondary"
            onPress={() => router.push(`/markets/${id}/orders`)}
          />
        </View>
      </View>
      {proposals.length > 0 && (
        <Info>
          {proposals.length === 1
            ? "Someone asked you to sell a product. Open the store to answer."
            : `You were asked to sell ${proposals.length} products. Open the store to answer.`}
        </Info>
      )}
      {waiting > 0 && (
        <Body>{waiting === 1 ? "1 order is" : `${waiting} orders are`} waiting for you.</Body>
      )}

      <Heading>Recent transactions</Heading>
      {entries.length === 0 && <Body>Nothing yet.</Body>}
      {entries.slice(0, shown).map((entry, index) => (
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
      {entries.length > shown && (
        <Button
          title={`Show more (${Math.min(10, entries.length - shown)})`}
          kind="secondary"
          onPress={() => setShown(shown + 10)}
        />
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    balanceBox: {
      backgroundColor: t.colors.balance,
      borderRadius: t.radius.card,
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      padding: 20,
      gap: 4,
      boxShadow: t.shadow.card || undefined,
    },
    balanceLabel: {
      fontFamily: t.fonts.accent,
      fontSize: 14,
      color: t.colors.balanceLabel,
      textTransform: t.upperTitles ? "uppercase" : "none",
    },
    balance: { fontSize: 36, fontFamily: t.fonts.heading, color: t.colors.balanceText },
    currency: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.balanceLabel },
    buttons: { flexDirection: "row", gap: 12 },
    half: { flex: 1 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    rowText: { flexShrink: 1, gap: 2 },
    note: { fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text },
    date: { fontFamily: t.fonts.regular, fontSize: 13, color: t.colors.muted },
    amount: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.good },
    negative: { color: t.colors.bad },
  });
