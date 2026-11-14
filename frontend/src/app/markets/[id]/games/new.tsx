// Opening a poker table: its name, blinds, buy-ins, seats and turn timer (decision 0030).
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { Chips } from "@/components/controls";
import { Body, Button, ErrorText, Field, Screen } from "@/components/ui";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [smallBlind, setSmallBlind] = useState("5");
  const [players, setPlayers] = useState(2);
  // Empty buy-ins mean the usual ones: 20 and 100 big blinds.
  const [minBuyIn, setMinBuyIn] = useState("");
  const [maxBuyIn, setMaxBuyIn] = useState("");
  const [timer, setTimer] = useState(0);
  const { run, error } = useAction();

  const small = Number(smallBlind) || 0;
  const big = 2 * small;

  function open() {
    return run(async () => {
      if (!name.trim()) throw new Mistake("Give the table a name.");
      if (small < 1) throw new Mistake("The small blind must be at least 1.");
      const table = await api<PokerTable>(`/markets/${id}/tables`, {
        method: "POST",
        body: {
          name,
          small_blind: small,
          max_players: players,
          min_buy_in: minBuyIn ? Number(minBuyIn) : null,
          max_buy_in: maxBuyIn ? Number(maxBuyIn) : null,
          turn_seconds: timer || null,
        },
      });
      router.replace(`/markets/${id}/games/${table.id}`);
    });
  }

  return (
    <Screen>
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
      <ErrorText>{error}</ErrorText>
      <Button title="Open the table" onPress={open} />
    </Screen>
  );
}
