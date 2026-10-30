import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, colors, ErrorText, Loading, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { LedgerEntry, Market, Member, PendingInvite } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type MarketPage = {
  market: Market;
  entries: LedgerEntry[];
  members: Member[];
  invites: PendingInvite[];
};

export default function MarketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [actionError, setActionError] = useState("");
  const { data, error, reload } = useLoad(
    useCallback(async (): Promise<MarketPage> => {
      // The market first: opening it pays any allowance that came due.
      const market = await api<Market>(`/markets/${id}`);
      const [entries, members, invites] = await Promise.all([
        api<LedgerEntry[]>(`/markets/${id}/ledger`),
        api<Member[]>(`/markets/${id}/members`),
        api<PendingInvite[]>(`/markets/${id}/invites`),
      ]);
      return { market, entries, members, invites };
    }, [id]),
  );

  async function cancelInvite(inviteId: number) {
    setActionError("");
    try {
      await api(`/markets/${id}/invites/${inviteId}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }
  const { market, entries, members, invites } = data;

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

      <Text style={styles.heading}>Invites</Text>
      {invites.length === 0 && <Body>No open invites.</Body>}
      {invites.map((invite) => (
        <View key={invite.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.note}>
              {invite.invited_display_name} (@{invite.invited_username})
            </Text>
            <Text style={styles.date}>
              Expires {new Date(invite.expires_at).toLocaleString()}
            </Text>
          </View>
          <Tappable onPress={() => cancelInvite(invite.id)} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </Tappable>
        </View>
      ))}
      <ErrorText>{actionError}</ErrorText>
      <Button title="Invite someone" onPress={() => router.push(`/markets/${id}/invite`)} />

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
  cancel: { color: colors.error, fontWeight: "600", padding: 4 },
});
