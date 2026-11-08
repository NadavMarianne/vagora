import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, ErrorText, Heading, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { Member, PendingInvite } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { useLoad } from "@/lib/use-load";

type MembersPage = { members: Member[]; invites: PendingInvite[] };

export default function MembersScreen() {
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(
    useCallback(async (): Promise<MembersPage> => {
      const [members, invites] = await Promise.all([
        api<Member[]>(`/markets/${id}/members`),
        api<PendingInvite[]>(`/markets/${id}/invites`),
      ]);
      return { members, invites };
    }, [id]),
  );
  const cancelling = useAction(reload);

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Members ({data.members.length})</Heading>
      {data.members.map((member) => (
        <Tappable
          key={member.username}
          style={styles.row}
          accessibilityRole="button"
          onPress={() => router.push(`/markets/${id}/members/${member.username}`)}
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{member.display_name}</Text>
            <Text style={styles.small}>@{member.username}</Text>
          </View>
          <Text style={styles.open}>Limits ›</Text>
        </Tappable>
      ))}

      <Heading>Open invites</Heading>
      {data.invites.length === 0 && <Body>No open invites.</Body>}
      {data.invites.map((invite) => (
        <View key={invite.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.name}>{invite.invited_display_name}</Text>
            <Text style={styles.small}>
              @{invite.invited_username} · expires {new Date(invite.expires_at).toLocaleString()}
            </Text>
          </View>
          <Tappable
            onPress={() =>
              cancelling.run(() => api(`/markets/${id}/invites/${invite.id}`, { method: "DELETE" }))
            }
            accessibilityRole="button"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Tappable>
        </View>
      ))}
      <ErrorText>{cancelling.error}</ErrorText>
      <Button title="Invite someone" onPress={() => router.push(`/markets/${id}/invite`)} />
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    rowText: { flexShrink: 1, gap: 2 },
    name: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text },
    small: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    open: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.primary },
    cancel: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.bad, padding: 4 },
  });
