import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  addsSomething,
  cleanLines,
  type DraftLine,
  LimitsEditor,
  toDraft,
} from "@/components/limits-editor";
import { Body, Button, colors, ErrorText, Info, Loading, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import type { Market, MemberPage } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { useLoad } from "@/lib/use-load";

type Page = { market: Market; member: MemberPage };

export default function MemberScreen() {
  const { id, username } = useLocalSearchParams<{ id: string; username: string }>();
  const { data, error, reload } = useLoad(
    useCallback(async (): Promise<Page> => {
      const [market, member] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<MemberPage>(`/markets/${id}/members/${username}`),
      ]);
      return { market, member };
    }, [id, username]),
  );

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }
  const { market, member } = data;

  return (
    <Screen>
      <Stack.Screen options={{ title: member.is_me ? "You" : member.display_name }} />
      <Title>{member.display_name}</Title>
      <Body>
        @{member.username} · joined {new Date(member.joined_at).toLocaleDateString()}
      </Body>

      <Text style={styles.heading}>Limits</Text>
      {member.is_me ? (
        <MyLimits market={market} member={member} onSaved={reload} />
      ) : (
        <>
          <Info>
            Things that are never allowed for {member.display_name}. No punishment can include them.
          </Info>
          {member.limits.length === 0 && <Body>None.</Body>}
          {member.limits.map((line, index) => (
            <View key={line} style={styles.line}>
              <Text style={styles.number}>{index + 1}.</Text>
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

/** Your own limits, editable. */
function MyLimits({
  market,
  member,
  onSaved,
}: {
  market: Market;
  member: MemberPage;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftLine[]>(() => toDraft(member.limits));
  const saving = useAction(onSaved);
  // Start over from what's saved whenever it changes (after saving, or from another phone).
  const saved = member.limits.join("\n");
  useEffect(() => {
    // Reset the editor to the saved lines when they change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(toDraft(saved ? saved.split("\n") : []));
  }, [saved]);

  const cost = addsSomething(member.limits, draft) ? (member.next_edit_cost ?? 0) : 0;
  const changed = cleanLines(draft).join("\n") !== saved;

  function save() {
    const send = () =>
      saving.run(() =>
        api(`/markets/${market.id}/limits`, { method: "PUT", body: { lines: cleanLines(draft) } }),
      );
    if (cost === 0) return send();
    Alert.alert(
      "Pay to edit your limits?",
      `This edit costs ${cost} ${market.currency_name}, and the coins vanish. In one edit you can add, change, and remove as much as you like. Only removing lines is free.`,
      [
        { text: "Back", style: "cancel" },
        { text: `Pay ${cost}`, onPress: send },
      ],
    );
  }

  return (
    <>
      <Info title="Your limits">
        Things that are never allowed for you. Everyone in the market can see them, and no
        punishment can include them. Removing lines is always free.{" "}
        {member.next_edit_cost
          ? `Adding or changing lines costs ${member.next_edit_cost} ${market.currency_name} per edit (one edit can change as much as you like).`
          : "Your next edit is free."}
      </Info>
      <LimitsEditor value={draft} onChange={setDraft} />
      {changed && (
        <Button
          title={cost > 0 ? `Save (costs ${cost} ${market.currency_name})` : "Save (free)"}
          onPress={save}
        />
      )}
      <ErrorText>{saving.error}</ErrorText>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  line: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  number: { fontSize: 16, color: colors.muted, width: 24 },
  lineText: { fontSize: 16, color: colors.text, flexShrink: 1 },
});
