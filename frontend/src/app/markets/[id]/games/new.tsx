// Opening a poker table: its name, blinds, buy-ins, seats, turn timer and look (decision 0030).
// With `?table=` it changes that table's settings instead (only whoever opened it, between hands).
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { Chips } from "@/components/controls";
import { DEFAULT_SKIN, skinById } from "@/components/poker-skins";
import { SkinPicker } from "@/components/skin-picker";
import { Body, Button, ErrorText, Field, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { PokerTable } from "@/lib/types";
import { Mistake, useAction } from "@/lib/use-action";

const PLAYERS = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: n, label: String(n) }));
// Seconds per turn. 0 means no timer.
const TIMERS = [
  { value: 0, label: "Off" },
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
];

const digits = (text: string) => text.replace(/\D/g, "");

export default function NewTableScreen() {
  const { id, table: tableId } = useLocalSearchParams<{ id: string; table?: string }>();
  const editing = tableId !== undefined;
  // Changing a table: its settings are loaded into the form first.
  const [loaded, setLoaded] = useState(!editing);
  const [name, setName] = useState("");
  const [smallBlind, setSmallBlind] = useState("5");
  const [players, setPlayers] = useState(2);
  // Empty buy-ins mean the usual ones: 20 and 100 big blinds.
  const [minBuyIn, setMinBuyIn] = useState("");
  const [maxBuyIn, setMaxBuyIn] = useState("");
  const [timer, setTimer] = useState(0);
  const [skin, setSkin] = useState(DEFAULT_SKIN);
  const { run, error } = useAction();

  useEffect(() => {
    if (!editing) return;
    api<PokerTable>(`/markets/${id}/tables/${tableId}`).then(
      (table) => {
        setName(table.name);
        setSmallBlind(String(table.small_blind));
        setPlayers(table.max_players);
        setMinBuyIn(String(table.min_buy_in));
        setMaxBuyIn(String(table.max_buy_in));
        setTimer(table.turn_seconds ?? 0);
        // A skin that's no longer offered shows (and saves) as the default.
        setSkin(skinById(table.skin).id);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [editing, id, tableId]);

  const small = Number(smallBlind) || 0;
  const big = 2 * small;

  function open() {
    return run(async () => {
      if (!name.trim()) throw new Mistake("Give the table a name.");
      if (small < 1) throw new Mistake("The small blind must be at least 1.");
      const table = await api<PokerTable>(`/markets/${id}/tables${editing ? `/${tableId}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: {
          name,
          small_blind: small,
          max_players: players,
          min_buy_in: minBuyIn ? Number(minBuyIn) : null,
          max_buy_in: maxBuyIn ? Number(maxBuyIn) : null,
          turn_seconds: timer || null,
          skin,
        },
      });
      if (editing) router.back();
      else router.replace(`/markets/${id}/games/${table.id}`);
    });
  }

  if (!loaded) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return (
    <Screen>
      {editing && <Stack.Screen options={{ title: "Table settings" }} />}
      {editing && (
        <Body>
          Changes apply between hands. Players keep their stacks, even above a lower biggest buy-in.
        </Body>
      )}
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Hotel game" />
      <Field
        label="Small blind"
        value={smallBlind}
        onChangeText={(text) => setSmallBlind(digits(text))}
        keyboardType="number-pad"
      />
      <Body>The big blind is twice that: {big}. The smallest bet is one big blind.</Body>
      <Chips
        label="Most players"
        options={PLAYERS}
        selected={[players]}
        onChange={([n]) => setPlayers(n)}
      />
      <Field
        label="Smallest buy-in"
        value={minBuyIn}
        onChangeText={(text) => setMinBuyIn(digits(text))}
        keyboardType="number-pad"
        placeholder={String(20 * big)}
      />
      <Field
        label="Biggest buy-in"
        value={maxBuyIn}
        onChangeText={(text) => setMaxBuyIn(digits(text))}
        keyboardType="number-pad"
        placeholder={String(100 * big)}
      />
      <Body>
        That’s how much each player brings to the table. Winnings can grow a stack past the biggest
        buy-in, but topping up only fills it to there.
      </Body>
      <Chips
        label="Time per turn"
        options={TIMERS}
        selected={[timer]}
        onChange={([seconds]) => setTimer(seconds)}
      />
      {timer > 0 && <Body>When time runs out, the player checks if they can, or folds.</Body>}
      <SkinPicker skin={skin} onChange={setSkin} />
      <ErrorText>{error}</ErrorText>
      <Button title={editing ? "Save" : "Open the table"} onPress={open} />
    </Screen>
  );
}
