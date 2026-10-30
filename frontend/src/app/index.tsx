import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, colors, ErrorText, Loading, Screen, Title } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { useSession } from "@/lib/session";
import type { Market, ReceivedInvite } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

export default function Home() {
  const { session } = useSession();
  const { data: markets, error, reload: reloadMarkets } = useLoad(
    useCallback(() => api<Market[]>("/markets"), []),
  );
  const { data: invites, reload: reloadInvites } = useLoad(
    useCallback(() => api<ReceivedInvite[]>("/invites"), []),
  );
  const [inviteError, setInviteError] = useState("");
  if (session.state !== "ready") return null;
  const { profile } = session;

  async function answer(invite: ReceivedInvite, accept: boolean) {
    setInviteError("");
    try {
      await api(`/invites/${invite.id}/${accept ? "accept" : "decline"}`, { method: "POST" });
      await Promise.all([reloadInvites(), reloadMarkets()]);
      if (accept) router.push(`/markets/${invite.market_id}`);
    } catch (e) {
      setInviteError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      await reloadInvites();
    }
  }

  return (
    <Screen>
      <Title>Hi, {profile.display_name}!</Title>
      <Body>@{profile.username}</Body>

      {invites && invites.length > 0 && (
        <>
          <Text style={styles.heading}>Invites for you</Text>
          {invites.map((invite) => (
            <View key={invite.id} style={styles.invite}>
              <Body>
                <Text style={styles.bold}>{invite.invited_by_display_name}</Text> invited you to{" "}
                <Text style={styles.bold}>{invite.market_name}</Text>
              </Body>
              <Text style={styles.muted}>
                Expires {new Date(invite.expires_at).toLocaleString()}
              </Text>
              <View style={styles.answers}>
                <View style={styles.answer}>
                  <Button title="Accept" onPress={() => answer(invite, true)} />
                </View>
                <View style={styles.answer}>
                  <Button title="Decline" kind="secondary" onPress={() => answer(invite, false)} />
                </View>
              </View>
            </View>
          ))}
          <ErrorText>{inviteError}</ErrorText>
        </>
      )}

      <Text style={styles.heading}>Your markets</Text>
      <ErrorText>{error}</ErrorText>
      {markets === null && !error && <Loading />}
      {markets?.length === 0 && <Body>You’re not in any market yet. Create one!</Body>}
      {markets?.map((market) => (
        <Tappable
          key={market.id}
          style={styles.card}
          onPress={() => router.push(`/markets/${market.id}`)}
          accessibilityRole="button"
        >
          <Text style={styles.cardTitle}>{market.name}</Text>
          <Text style={styles.cardBalance}>
            {market.my_balance.toLocaleString()} {market.currency_name}
          </Text>
        </Tappable>
      ))}

      <Button title="Create a market" onPress={() => router.push("/markets/new")} />
      <View style={styles.spacer} />
      <Button title="Log out" kind="secondary" onPress={() => signOut(auth)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.text, flexShrink: 1 },
  cardBalance: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  spacer: { height: 8 },
  invite: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  bold: { fontWeight: "700" },
  muted: { fontSize: 13, color: colors.muted },
  answers: { flexDirection: "row", gap: 12 },
  answer: { flex: 1 },
});
