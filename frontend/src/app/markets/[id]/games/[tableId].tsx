// A poker table: the seats and stacks, the hand being played, and your turn (decision 0030).
// The cards are real; this screen tells the dealer what to deal and keeps the chips.
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Chips } from "@/components/controls";
import {
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Info,
  Loading,
  Screen,
  TimeLeft,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { Market, PokerHand, PokerTable } from "@/lib/types";
import { Mistake, useAction } from "@/lib/use-action";
import { useLoad, useReloadAt } from "@/lib/use-load";

const digits = (text: string) => text.replace(/\D/g, "");

/** What the dealer deals at the start of each betting round. */
const DEAL: Record<string, string> = {
  preflop: "Deal two cards to each player.",
  flop: "Deal the flop: three cards face up.",
  turn: "Deal the turn: one more card.",
  river: "Deal the river: the last card.",
};

/** At the showdown: the board cards still to deal, after the last street that was bet on. */
const STILL_TO_DEAL: Record<string, string> = {
  preflop: "Deal the flop, the turn and the river, then turn your cards over.",
  flop: "Deal the turn and the river, then turn your cards over.",
  turn: "Deal the river, then turn your cards over.",
  river: "Turn your cards over.",
};

const STREET_NAMES: Record<string, string> = {
  preflop: "Before the flop",
  flop: "The flop",
  turn: "The turn",
  river: "The river",
  showdown: "Showdown",
  done: "Hand over",
};

export default function TableScreen() {
  const { id, tableId } = useLocalSearchParams<{ id: string; tableId: string }>();
  const url = `/markets/${id}/tables/${tableId}`;
  const { data, error, reload } = useLoad(
    useCallback(async () => {
      const [market, table] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<PokerTable>(url),
      ]);
      return { market, table };
    }, [id, url]),
  );
  useReloadAt([data?.table.hand?.turn_ends_at], reload);

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }
  const { market, table } = data;
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";

  return (
    <Screen>
      <Stack.Screen options={{ title: table.name }} />
      <Body>
        Blinds {table.small_blind}/{table.big_blind} · buy-in {table.min_buy_in.toLocaleString()} to{" "}
        {table.max_buy_in.toLocaleString()} {market.currency_name}
        {table.turn_seconds ? ` · ${table.turn_seconds} s per turn` : ""}
      </Body>

      <Seats table={table} />

      {hand && <HandPanel table={table} hand={hand} url={url} reload={reload} />}

      {table.my_seat !== null && !playing && <DealButton table={table} url={url} reload={reload} />}

      {table.my_seat === null ? (
        <SitDown table={table} url={url} balance={market.my_balance} reload={reload} />
      ) : (
        <MySeat table={table} url={url} reload={reload} />
      )}

      {table.seats.length === 0 && <CloseTable table={table} url={url} marketId={id} />}
    </Screen>
  );
}

/** A seat's player name, or "Seat 4" if they've gone. */
function seatName(table: PokerTable, seat: number): string {
  const player = table.seats.find((s) => s.number === seat);
  if (!player) return `Seat ${seat + 1}`;
  return player.number === table.my_seat ? "You" : player.display_name;
}

function Seats({ table }: { table: PokerTable }) {
  const styles = useStyles(makeStyles);
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  return (
    <View style={styles.seats}>
      {table.seats.map((seat) => {
        const inHand = playing ? hand.players.find((p) => p.seat === seat.number) : undefined;
        const marks = [
          hand?.button === seat.number && "Dealer",
          playing && hand.small_blind_seat === seat.number && "SB",
          playing && hand.big_blind_seat === seat.number && "BB",
        ].filter(Boolean);
        const turn = playing && hand.to_act === seat.number;
        const state = !playing
          ? ""
          : !inHand
            ? "next hand"
            : inHand.folded
              ? "folded"
              : inHand.all_in
                ? "all-in"
                : inHand.street_bet > 0
                  ? `bet ${inHand.street_bet.toLocaleString()}`
                  : "";
        return (
          <View
            key={seat.number}
            style={[styles.seat, turn && styles.seatTurn, inHand?.folded && styles.seatFolded]}
          >
            <View style={styles.seatText}>
              <Text style={styles.seatName}>
                {seat.number === table.my_seat ? "You" : seat.display_name}
                {marks.length > 0 && <Text style={styles.marks}> · {marks.join(" · ")}</Text>}
              </Text>
              {state !== "" && <Text style={styles.small}>{state}</Text>}
            </View>
            <Text style={styles.stack}>{seat.stack.toLocaleString()}</Text>
          </View>
        );
      })}
      {table.seats.length === 0 && <Body>Nobody is sitting here yet.</Body>}
    </View>
  );
}

/** "Noa raised to 40", for the last few things that happened. */
function describe(table: PokerTable, entry: PokerHand["log"][number]): string {
  const who = seatName(table, entry.seat);
  const amount = entry.amount.toLocaleString();
  const what: Record<string, string> = {
    small_blind: `posted the small blind (${amount})`,
    big_blind: `posted the big blind (${amount})`,
    fold: "folded",
    check: "checked",
    call: `called (${amount} in this round)`,
    raise: `raised to ${amount}`,
  };
  return `${who} ${what[entry.action] ?? entry.action}${entry.timed_out ? ", time ran out" : ""}`;
}

function HandPanel({
  table,
  hand,
  url,
  reload,
}: {
  table: PokerTable;
  hand: PokerHand;
  url: string;
  reload: () => void;
}) {
  const styles = useStyles(makeStyles);
  const pot = hand.pots.reduce((sum, p) => sum + p.amount, 0);
  const betting = hand.street !== "showdown" && hand.street !== "done";
  return (
    <Card style={styles.panel}>
      <Text style={styles.street}>
        Hand {hand.number} · {STREET_NAMES[hand.street]}
      </Text>
      {betting && <Info>{DEAL[hand.street]}</Info>}
      {hand.street === "showdown" && <Info>{STILL_TO_DEAL[hand.reached]}</Info>}

      {hand.street !== "done" && (
        <Text style={styles.pot}>
          Pot {pot.toLocaleString()}
          {hand.pots.length > 1 && (
            <Text style={styles.small}>
              {" "}
              ({hand.pots.map((p, i) => `${i === 0 ? "main" : "side"} ${p.amount}`).join(", ")})
            </Text>
          )}
        </Text>
      )}

      {betting && hand.to_act !== null && !hand.my_turn && (
        <Text style={styles.waiting}>
          {seatName(table, hand.to_act)}’s turn
          {hand.turn_ends_at && (
            <Text style={styles.small}>
              {" · "}
              <TimeLeft until={hand.turn_ends_at} />
            </Text>
          )}
        </Text>
      )}
      {/* A fresh one each turn, so an old raise amount doesn't stay. */}
      {hand.my_turn && <MyTurn key={hand.log.length} hand={hand} url={url} reload={reload} />}
      {hand.street === "showdown" && (
        <Showdown key={hand.number} table={table} hand={hand} url={url} reload={reload} />
      )}
      {hand.street === "done" && <Result table={table} hand={hand} />}

      {hand.street !== "done" && hand.log.length > 0 && (
        <View style={styles.log}>
          {hand.log.slice(-4).map((entry, i) => (
            <Text key={i} style={styles.small}>
              {describe(table, entry)}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function MyTurn({ hand, url, reload }: { hand: PokerHand; url: string; reload: () => void }) {
  const styles = useStyles(makeStyles);
  const turn = hand.my_turn!;
  const { run, error } = useAction(reload);
  const [raiseTo, setRaiseTo] = useState(turn.raise_min ? String(turn.raise_min) : "");
  // Folding takes two taps, so it never happens by accident.
  const [foldArmed, setFoldArmed] = useState(false);

  const act = (action: string, amount?: number) =>
    run(() =>
      api(`${url}/hands/current/act`, {
        method: "POST",
        body: amount === undefined ? { action } : { action, amount },
      }),
    );

  const pot = hand.pots.reduce((sum, p) => sum + p.amount, 0);
  const clamp = (n: number) => Math.max(turn.raise_min!, Math.min(turn.raise_max!, n));
  const word = hand.current_bet === 0 ? "Bet" : "Raise to";

  return (
    <View style={styles.turn}>
      <Text style={styles.yourTurn}>
        Your turn
        {hand.turn_ends_at && (
          <Text style={styles.small}>
            {" · "}
            <TimeLeft until={hand.turn_ends_at} />
          </Text>
        )}
      </Text>
      <View style={styles.buttons}>
        <View style={styles.half}>
          {foldArmed ? (
            <Button title="Tap again to fold" kind="bad" onPress={() => act("fold")} />
          ) : (
            <Button title="Fold" kind="secondary" onPress={() => setFoldArmed(true)} />
          )}
        </View>
        <View style={styles.half}>
          {turn.can_check ? (
            <Button title="Check" onPress={() => act("check")} />
          ) : (
            <Button title={`Call ${turn.to_call.toLocaleString()}`} onPress={() => act("call")} />
          )}
        </View>
      </View>
      {foldArmed && (
        <Button title="Don't fold" kind="secondary" onPress={() => setFoldArmed(false)} />
      )}

      {turn.raise_min !== null && turn.raise_max !== null && (
        <View style={styles.raise}>
          <Field
            label={`${word} (${turn.raise_min.toLocaleString()} to ${turn.raise_max.toLocaleString()})`}
            value={raiseTo}
            onChangeText={(text) => setRaiseTo(digits(text))}
            keyboardType="number-pad"
          />
          <Chips
            options={[
              { value: "min", label: "Min" },
              { value: "pot", label: "Pot" },
              { value: "max", label: "All-in" },
            ]}
            selected={[]}
            onChange={([pick]) =>
              setRaiseTo(
                String(
                  pick === "min"
                    ? turn.raise_min
                    : pick === "max"
                      ? turn.raise_max
                      : clamp(hand.current_bet + pot + turn.to_call),
                ),
              )
            }
          />
          <Button
            title={`${word} ${Number(raiseTo || 0).toLocaleString()}`}
            kind="good"
            onPress={() =>
              run(async () => {
                const amount = Number(raiseTo);
                if (!amount) throw new Mistake("Choose how much.");
                if (amount === turn.raise_max) return act("all_in");
                await api(`${url}/hands/current/act`, {
                  method: "POST",
                  body: { action: "raise", amount },
                });
              })
            }
          />
        </View>
      )}
      {turn.raise_min === null && turn.to_call > 0 && <Body>You can only call or fold now.</Body>}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function Showdown({
  table,
  hand,
  url,
  reload,
}: {
  table: PokerTable;
  hand: PokerHand;
  url: string;
  reload: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { run, error } = useAction(reload);
  const [picks, setPicks] = useState<number[][]>(() => hand.contested.map(() => []));
  const me = hand.players.find((p) => p.seat === table.my_seat);
  const stillIn = me !== undefined && !me.folded;
  const claim = hand.claim;
  const potName = (i: number) => (i === 0 ? "Main pot" : `Side pot ${i}`);

  if (claim) {
    const waitingFor = hand.players
      .filter((p) => !p.folded && !claim.confirmed.includes(p.seat))
      .map((p) => seatName(table, p.seat));
    const iConfirmed = table.my_seat !== null && claim.confirmed.includes(table.my_seat);
    return (
      <View style={styles.turn}>
        <Text style={styles.yourTurn}>{seatName(table, claim.by)} says:</Text>
        {hand.contested.map((pot, i) => (
          <Text key={i} style={styles.claimLine}>
            {potName(i)} ({pot.amount.toLocaleString()}):{" "}
            {(claim.winners[i] ?? []).map((s) => seatName(table, s)).join(" and ")}
            {(claim.winners[i] ?? []).length > 1 ? " split it" : " won"}
          </Text>
        ))}
        {stillIn && !iConfirmed ? (
          <View style={styles.buttons}>
            <View style={styles.half}>
              <Button
                title="That's right"
                kind="good"
                onPress={() => run(() => api(`${url}/hands/current/confirm`, { method: "POST" }))}
              />
            </View>
            <View style={styles.half}>
              <Button
                title="That's wrong"
                kind="bad"
                onPress={() => run(() => api(`${url}/hands/current/reject`, { method: "POST" }))}
              />
            </View>
          </View>
        ) : (
          <Body>Waiting for {waitingFor.join(" and ")} to agree.</Body>
        )}
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  if (!stillIn) {
    return <Body>The players still in the hand say who won.</Body>;
  }
  return (
    <View style={styles.turn}>
      <Text style={styles.yourTurn}>Who won?</Text>
      {hand.contested.map((pot, i) => (
        <Chips
          key={i}
          label={`${potName(i)} (${pot.amount.toLocaleString()}). Pick two or more for a split.`}
          multiple
          options={pot.eligible.map((seat) => ({ value: seat, label: seatName(table, seat) }))}
          selected={picks[i] ?? []}
          onChange={(chosen) => setPicks(picks.map((p, j) => (j === i ? chosen : p)))}
        />
      ))}
      <Button
        title="Say who won"
        onPress={() =>
          run(async () => {
            if (picks.some((p) => p.length === 0)) throw new Mistake("Pick a winner for each pot.");
            await api(`${url}/hands/current/claim`, { method: "POST", body: { winners: picks } });
          })
        }
      />
      <Body>Everyone else still in the hand then agrees, and the chips move.</Body>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function Result({ table, hand }: { table: PokerTable; hand: PokerHand }) {
  const styles = useStyles(makeStyles);
  const wins = Object.entries(hand.payouts).filter(([, amount]) => amount > 0);
  return (
    <View style={styles.turn}>
      {wins.map(([seat, amount]) => (
        <Text key={seat} style={styles.claimLine}>
          {seatName(table, Number(seat))} {seatName(table, Number(seat)) === "You" ? "get" : "gets"}{" "}
          {amount.toLocaleString()}
        </Text>
      ))}
    </View>
  );
}

function DealButton({
  table,
  url,
  reload,
}: {
  table: PokerTable;
  url: string;
  reload: () => void;
}) {
  const { run, error } = useAction(reload);
  const withChips = table.seats.filter((s) => s.stack > 0).length;
  if (withChips < 2) {
    return <Body>A hand needs at least two players with chips.</Body>;
  }
  return (
    <>
      <Button
        title={table.hand ? "Deal the next hand" : "Deal the first hand"}
        onPress={() => run(() => api(`${url}/hands`, { method: "POST" }))}
      />
      <ErrorText>{error}</ErrorText>
    </>
  );
}

function SitDown({
  table,
  url,
  balance,
  reload,
}: {
  table: PokerTable;
  url: string;
  balance: number;
  reload: () => void;
}) {
  const [buyIn, setBuyIn] = useState(String(Math.min(table.max_buy_in, Math.max(balance, 0))));
  const { run, error } = useAction(reload);
  if (table.seats.length >= table.max_players) return <Body>The table is full.</Body>;
  return (
    <Card>
      <Field
        label={`Buy-in (${table.min_buy_in.toLocaleString()} to ${table.max_buy_in.toLocaleString()}, you have ${balance.toLocaleString()})`}
        value={buyIn}
        onChangeText={(text) => setBuyIn(digits(text))}
        keyboardType="number-pad"
      />
      <Button
        title="Sit down"
        onPress={() =>
          run(() => api(`${url}/sit`, { method: "POST", body: { buy_in: Number(buyIn) } }))
        }
      />
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function MySeat({ table, url, reload }: { table: PokerTable; url: string; reload: () => void }) {
  const styles = useStyles(makeStyles);
  const me = table.seats.find((s) => s.number === table.my_seat)!;
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  const inHand = playing ? hand.players.find((p) => p.seat === me.number) : undefined;
  const room = table.max_buy_in - me.stack;
  const [amount, setAmount] = useState("");
  const [leaving, setLeaving] = useState(false);
  const topUp = useAction(reload);
  const leave = useAction(reload);

  const canTopUp = !inHand && room > 0;
  const canLeave = !inHand || inHand.folded;
  if (!canTopUp && !canLeave) return null;

  return (
    <Card style={styles.mySeat}>
      {canTopUp && (
        <>
          <Field
            label={`Top up (up to ${room.toLocaleString()})`}
            value={amount}
            onChangeText={(text) => setAmount(digits(text))}
            keyboardType="number-pad"
          />
          <Button
            title="Add chips"
            kind="secondary"
            onPress={() =>
              topUp.run(async () => {
                if (!Number(amount)) throw new Mistake("Choose how much.");
                await api(`${url}/top-up`, { method: "POST", body: { amount: Number(amount) } });
                setAmount("");
              })
            }
          />
          <ErrorText>{topUp.error}</ErrorText>
        </>
      )}
      {canLeave &&
        (leaving ? (
          <>
            <Body>Your {me.stack.toLocaleString()} chips go back to your balance.</Body>
            <Button
              title="Get up"
              kind="bad"
              onPress={() => leave.run(() => api(`${url}/leave`, { method: "POST" }))}
            />
            <Button title="Stay" kind="secondary" onPress={() => setLeaving(false)} />
          </>
        ) : (
          <Button title="Get up from the table" kind="secondary" onPress={() => setLeaving(true)} />
        ))}
      <ErrorText>{leave.error}</ErrorText>
    </Card>
  );
}

function CloseTable({
  table,
  url,
  marketId,
}: {
  table: PokerTable;
  url: string;
  marketId: string;
}) {
  const { run, error } = useAction();
  return (
    <>
      <Button
        title="Close this table"
        kind="secondary"
        onPress={() =>
          run(async () => {
            await api(`${url}/close`, { method: "POST" });
            router.replace(`/markets/${marketId}/games`);
          })
        }
      />
      <ErrorText>{error}</ErrorText>
      <Body>Only whoever opened it ({table.creator_username}) can close it.</Body>
    </>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    seats: { gap: 8 },
    seat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: t.radius.card,
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    seatTurn: { borderColor: t.colors.primary, borderWidth: Math.max(2, t.borderWidth) },
    seatFolded: { opacity: 0.5 },
    seatText: { flex: 1, gap: 2 },
    seatName: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text },
    marks: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.primary },
    stack: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.text },
    small: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    panel: { gap: 10 },
    street: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.text },
    pot: { fontSize: 22, fontFamily: t.fonts.bold, color: t.colors.text },
    waiting: { fontSize: 16, fontFamily: t.fonts.regular, color: t.colors.text },
    turn: { gap: 10 },
    yourTurn: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.primary },
    buttons: { flexDirection: "row", gap: 10 },
    half: { flex: 1 },
    raise: { gap: 8 },
    claimLine: { fontSize: 16, fontFamily: t.fonts.regular, color: t.colors.text },
    log: { gap: 2, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8 },
    mySeat: { gap: 10 },
  });
