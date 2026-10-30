import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, colors, ErrorText, Loading, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { useSession } from "@/lib/session";
import type { Market } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

export default function Home() {
  const { session } = useSession();
  const { data: markets, error } = useLoad(useCallback(() => api<Market[]>("/markets"), []));
  if (session.state !== "ready") return null;
  const { profile } = session;

  return (
    <Screen>
      <Title>Hi, {profile.display_name}!</Title>
      <Body>@{profile.username}</Body>

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
});
