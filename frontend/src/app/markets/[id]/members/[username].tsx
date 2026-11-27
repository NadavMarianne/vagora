import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { CoinsSent, type Sent } from "@/components/coins-sent";
import {
  addsSomething,
  cleanLines,
  type DraftLine,
  LimitsEditor,
  toDraft,
} from "@/components/limits-editor";
import { Body, Button, ErrorText, Field, Info, Loading, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import type { Market, MemberPage, SentEntry } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { useLoad } from "@/lib/use-load";
import type { Theme } from "@/lib/themes";
import { useStyles } from "@/lib/theme";

type Page = { market: Market; member: MemberPage };

export default function MemberScreen() {
  const styles = useStyles(makeStyles);
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

      {!member.is_me && market.transfers_enabled && (
        <SendCoins market={market} member={member} onSent={reload} />
      )}

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

/** Sending this member coins from your balance, with an optional note. It can't be undone, so
 * it asks first, then celebrates. Under it, your last sends to them. */
function SendCoins({
  market,
  member,
  onSent,
}: {
  market: Market;
  member: MemberPage;
  onSent: () => Promise<void>;
}) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const recent = useLoad(
    useCallback(
      () => api<SentEntry[]>(`/markets/${market.id}/sent/${member.username}`),
      [market.id, member.username],
    ),
  );
  const sending = useAction(async () => {
    await Promise.all([onSent(), recent.reload()]);
  });
  const coins = `${amount.toLocaleString()} ${market.currency_name}`;
  const closeCelebration = useCallback(() => setSent(null), []);

  function send() {
    if (amount <= 0 || amount > market.my_balance) return;
    Alert.alert(`Send ${coins} to ${member.display_name}?`, "Sent coins can't be taken back.", [
      { text: "Back", style: "cancel" },
      {
        text: "Send",
        onPress: () =>
          sending.run(async () => {
            await api(`/markets/${market.id}/send`, {
              method: "POST",
              body: { to: member.username, amount, note },
            });
            setSent({
              amount,
              currency: market.currency_name,
              to: member.display_name,
              note: note.trim(),
            });
            setOpen(false);
            setAmount(0);
            setNote("");
          }),
      },
    ]);
  }

  return (
    <>
      <CoinsSent sent={sent} onClose={closeCelebration} />
      {open ? (
        <View style={styles.send}>
          <Text style={styles.heading}>Send coins</Text>
          <Body>
            You have {market.my_balance.toLocaleString()} {market.currency_name}.
          </Body>
          <Field
            label="How many"
            value={amount ? String(amount) : ""}
            onChangeText={(text) => setAmount(Number(text.replace(/\D/g, "")) || 0)}
            keyboardType="number-pad"
          />
          <Field
            label="A note (optional)"
            value={note}
            onChangeText={setNote}
            maxLength={100}
            placeholder="Happy birthday!"
          />
          <View style={styles.buttons}>
            <View style={styles.half}>
              <Button title="Back" kind="secondary" onPress={() => setOpen(false)} />
            </View>
            <View style={styles.half}>
              <Button title="Send" onPress={send} />
            </View>
          </View>
          {amount > market.my_balance && <ErrorText>{"You don't have that many."}</ErrorText>}
          <ErrorText>{sending.error}</ErrorText>
        </View>
      ) : (
        <Button title="Send coins" onPress={() => setOpen(true)} />
      )}
      {recent.data && recent.data.length > 0 && (
        <View style={styles.recent}>
          <Text style={styles.recentTitle}>Your last sends to {member.display_name}</Text>
          {recent.data.map((entry, index) => (
            <View key={index} style={styles.recentRow}>
              <View style={styles.recentText}>
                {entry.note !== "" && <Text style={styles.recentNote}>{entry.note}</Text>}
                <Text style={styles.recentDate}>{new Date(entry.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.recentAmount}>
                {entry.amount.toLocaleString()} {market.currency_name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    heading: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.text, marginTop: 8 },
    send: { gap: 8 },
    buttons: { flexDirection: "row", gap: 8 },
    half: { flex: 1 },
    recent: { gap: 6 },
    recentTitle: { fontSize: 14, fontFamily: t.fonts.bold, color: t.colors.muted },
    recentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    recentText: { flex: 1 },
    recentNote: { fontSize: 15, fontFamily: t.fonts.regular, color: t.colors.text },
    recentDate: { fontSize: 12, fontFamily: t.fonts.regular, color: t.colors.muted },
    recentAmount: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.text },
    line: { flexDirection: "row", gap: 8, paddingVertical: 4 },
    number: { fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.muted, width: 24 },
    lineText: { fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, flexShrink: 1 },
  });
