// A poker table: the seats and stacks, the hand being played, and your turn (decision 0030).
// The cards are real; this screen tells the dealer what to deal and keeps the chips.
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AmountSlider, POKER } from "@/components/amount-slider";
import { PokerTableView } from "@/components/poker-table";
import { Chips } from "@/components/controls";
import {
  Body,
  Button,
  Card,
  ErrorText,
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
  // Before sitting down: the empty seat tapped on the table.
  const [picked, setPicked] = useState<number | null>(null);

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

      <PokerTableView table={table} picked={picked} onPick={setPicked} />

      {hand && <HandPanel table={table} hand={hand} url={url} reload={reload} />}

      {table.my_seat !== null && !playing && <DealButton table={table} url={url} reload={reload} />}

      {table.my_seat === null ? (
        <SitDown
          table={table}
          seat={picked}
          url={url}
          balance={market.my_balance}
          reload={reload}
        />
      ) : (
        <MySeat table={table} url={url} balance={market.my_balance} reload={reload} />
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
  const betting = hand.street !== "showdown" && hand.street !== "done";
  return (
    <Card style={styles.panel}>
      <Text style={styles.street}>
        Hand {hand.number} · {STREET_NAMES[hand.street]}
      </Text>
      {betting && (hand.waiting_for_cards || !table.turn_seconds) && (
        <Info>{DEAL[hand.street]}</Info>
      )}
      {hand.street === "showdown" && <Info>{STILL_TO_DEAL[hand.reached]}</Info>}
      {hand.waiting_for_cards && <CardsOut table={table} hand={hand} url={url} reload={reload} />}
      {hand.street !== "done" && hand.pots.length > 1 && (
        <Text style={styles.small}>
          {hand.pots
            .map((p, i) => `${i === 0 ? "Main pot" : `side pot ${i}`} ${p.amount.toLocaleString()}`)
            .join(", ")}
        </Text>
      )}
      {/* A fresh one each turn, so an old raise amount doesn't stay. */}
      {hand.my_turn && <MyTurn key={hand.log.length} table={table} hand={hand} url={url} reload={reload} />}
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

/** With a turn timer, each round waits for its cards: the dealer says when they're out. */
function CardsOut({
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
  const { run, error } = useAction(reload);
  if (!hand.i_say_cards_out) {
    const dealer = hand.dealer_seat !== null ? seatName(table, hand.dealer_seat) : "The dealer";
    return <Body>{dealer} is dealing. Betting and the timer start once the cards are out.</Body>;
  }
  return (
    <>
      <Button
        title="Cards are out"
        colors={POKER.gold}
        onPress={() => run(() => api(`${url}/hands/current/cards-out`, { method: "POST" }))}
      />
      <Body>You dealt this hand. Tap once the cards are on the table, and the timer starts.</Body>
      <ErrorText>{error}</ErrorText>
    </>
  );
}

function MyTurn({
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
  const turn = hand.my_turn!;
  const { run, error } = useAction(reload);
  // Folding takes two taps, so it never happens by accident.
  const [foldArmed, setFoldArmed] = useState(false);
  const [raising, setRaising] = useState(false);
  // The amount picked in the raise pop-up. It stays when the pop-up closes, for this turn only
  // (each turn gets a fresh MyTurn).
  const [raiseTo, setRaiseTo] = useState(turn.raise_min ?? 0);

  const act = (body: { action: string; amount?: number }) =>
    run(() => api(`${url}/hands/current/act`, { method: "POST", body }));
  const canRaise = turn.raise_min !== null && turn.raise_max !== null;
  const word = hand.current_bet === 0 ? "Bet" : "Raise";

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
      {foldArmed ? (
        <View style={styles.buttons}>
          <View style={styles.half}>
            <Button
              title="Tap again to fold"
              colors={POKER.fold}
              onPress={() => act({ action: "fold" })}
            />
          </View>
          <View style={styles.half}>
            <Button title="Don’t fold" kind="secondary" onPress={() => setFoldArmed(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.half}>
            <Button title="Fold" colors={POKER.fold} onPress={() => setFoldArmed(true)} />
          </View>
          <View style={styles.half}>
            {turn.can_check ? (
              <Button title="Check" colors={POKER.check} onPress={() => act({ action: "check" })} />
            ) : (
              <Button
                title={`Call ${turn.to_call.toLocaleString()}`}
                colors={POKER.call}
                onPress={() => act({ action: "call" })}
              />
            )}
          </View>
          {canRaise && (
            <View style={styles.half}>
              <Button title={word} colors={POKER.gold} onPress={() => setRaising(true)} />
            </View>
          )}
        </View>
      )}
      {!canRaise && turn.to_call > 0 && <Body>You can only call or fold now.</Body>}
      <ErrorText>{error}</ErrorText>
      {raising && (
        <RaiseSheet
          table={table}
          hand={hand}
          word={word}
          amount={raiseTo}
          setAmount={setRaiseTo}
          onClose={() => setRaising(false)}
          onRaise={(amount) => {
            setRaising(false);
            return act(
              amount >= turn.raise_max! ? { action: "all_in" } : { action: "raise", amount },
            );
          }}
        />
      )}
    </View>
  );
}

/** The raise pop-up: a slider from the smallest raise to all-in, with shortcuts for part of the
 * pot. */
function RaiseSheet({
  table,
  hand,
  word,
  amount,
  setAmount,
  onClose,
  onRaise,
}: {
  table: PokerTable;
  hand: PokerHand;
  word: string;
  amount: number;
  setAmount: (amount: number) => void;
  onClose: () => void;
  onRaise: (amount: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const turn = hand.my_turn!;
  const max = turn.raise_max!;
  const pot = hand.pots.reduce((sum, p) => sum + p.amount, 0);
  // Part of the pot: call first, then raise by that part of the pot as it is after the call.
  const part = (share: number) => hand.current_bet + Math.round(share * (pot + turn.to_call));
  const allIn = amount >= max;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      {/* Typing an amount: the sheet moves up above the keyboard. */}
      <KeyboardAvoidingView style={styles.sheetArea} behavior="padding">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.street}>{word === "Bet" ? "Bet" : "Raise to"}</Text>
        <AmountSlider
          min={turn.raise_min!}
          max={max}
          value={amount}
          onChange={setAmount}
          step={table.small_blind}
          shortcuts={[
            { label: "¼ pot", value: part(1 / 4) },
            { label: "⅓ pot", value: part(1 / 3) },
            { label: "½ pot", value: part(1 / 2) },
            { label: "Pot", value: part(1) },
          ]}
          maxLabel="All-in"
        />
        <Button
          title={allIn ? `All-in ${max.toLocaleString()}` : `${word} ${amount.toLocaleString()}`}
          colors={POKER.gold}
          onPress={() => onRaise(amount)}
        />
        <Button title="Cancel" kind="secondary" onPress={onClose} />
      </View>
      </KeyboardAvoidingView>
    </Modal>
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
  seat,
  url,
  balance,
  reload,
}: {
  table: PokerTable;
  /** The empty seat picked on the table. */
  seat: number | null;
  url: string;
  balance: number;
  reload: () => void;
}) {
  const most = Math.min(table.max_buy_in, balance);
  const [buyIn, setBuyIn] = useState(most);
  const { run, error } = useAction(reload);
  if (table.seats.length >= table.max_players) return <Body>The table is full.</Body>;
  if (most < table.min_buy_in) {
    return (
      <Body>
        Sitting down takes at least {table.min_buy_in.toLocaleString()}, and you have{" "}
        {balance.toLocaleString()}.
      </Body>
    );
  }
  if (seat === null || table.seats.some((s) => s.number === seat)) {
    return <Body>Tap an empty seat on the table to sit there.</Body>;
  }
  return (
    <Card>
      <AmountSlider
        label={`Seat ${seat + 1}. Buy-in (you have ${balance.toLocaleString()})`}
        min={table.min_buy_in}
        max={most}
        value={buyIn}
        onChange={setBuyIn}
        step={table.big_blind}
        maxLabel="Max"
      />
      <Button
        title={`Sit down with ${buyIn.toLocaleString()}`}
        onPress={() => run(() => api(`${url}/sit`, { method: "POST", body: { buy_in: buyIn, seat } }))}
      />
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

/** Between your hands: add chips, take some back, or get up. */
function MySeat({
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
  const styles = useStyles(makeStyles);
  const me = table.seats.find((s) => s.number === table.my_seat)!;
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  const inHand = playing ? hand.players.find((p) => p.seat === me.number) : undefined;
  const room = Math.min(table.max_buy_in - me.stack, balance);
  const [doing, setDoing] = useState<"top-up" | "cash-out" | "leave" | null>(null);
  const [amount, setAmount] = useState(0);
  const { run, error } = useAction(reload);

  const canTopUp = !inHand && room > 0;
  const canCashOut = !inHand && me.stack > 0;
  const canLeave = !inHand || inHand.folded;
  if (!canTopUp && !canCashOut && !canLeave) return null;

  function start(what: "top-up" | "cash-out" | "leave") {
    setDoing(what);
    setAmount(what === "top-up" ? room : Math.ceil(me.stack / 2));
  }
  const finish = (path: string, body?: object) =>
    run(async () => {
      await api(`${url}/${path}`, { method: "POST", body });
      setDoing(null);
    });

  if (doing === "top-up" && canTopUp) {
    return (
      <Card style={styles.mySeat}>
        <AmountSlider
          label={`Add chips (up to ${room.toLocaleString()})`}
          min={1}
          max={room}
          value={amount}
          onChange={setAmount}
          step={table.small_blind}
          maxLabel="Max"
        />
        <Button
          title={`Add ${amount.toLocaleString()}`}
          onPress={() => finish("top-up", { amount })}
        />
        <Button title="Never mind" kind="secondary" onPress={() => setDoing(null)} />
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }
  if (doing === "cash-out" && canCashOut) {
    return (
      <Card style={styles.mySeat}>
        <AmountSlider
          label="Take chips back to your balance"
          min={1}
          max={me.stack}
          value={amount}
          onChange={setAmount}
          step={table.small_blind}
          maxLabel="All"
        />
        <Body>You stay at the table with the rest. With nothing left, you sit out the hands.</Body>
        <Button
          title={`Cash out ${amount.toLocaleString()}`}
          onPress={() => finish("cash-out", { amount })}
        />
        <Button title="Never mind" kind="secondary" onPress={() => setDoing(null)} />
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }
  if (doing === "leave" && canLeave) {
    return (
      <Card style={styles.mySeat}>
        <Body>Your {me.stack.toLocaleString()} chips go back to your balance.</Body>
        <Button title="Get up" kind="bad" onPress={() => finish("leave")} />
        <Button title="Stay" kind="secondary" onPress={() => setDoing(null)} />
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }
  return (
    <Card style={styles.mySeat}>
      {(canTopUp || canCashOut) && (
        <View style={styles.buttons}>
          {canTopUp && (
            <View style={styles.half}>
              <Button title="Add chips" kind="secondary" onPress={() => start("top-up")} />
            </View>
          )}
          {canCashOut && (
            <View style={styles.half}>
              <Button title="Cash out" kind="secondary" onPress={() => start("cash-out")} />
            </View>
          )}
        </View>
      )}
      {canLeave && (
        <Button title="Get up from the table" kind="secondary" onPress={() => start("leave")} />
      )}
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
    small: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    panel: { gap: 10 },
    street: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.text },
    turn: { gap: 10 },
    yourTurn: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.primary },
    buttons: { flexDirection: "row", gap: 10 },
    half: { flex: 1 },
    sheetArea: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      gap: 12,
      padding: 20,
      paddingBottom: 32,
      borderTopLeftRadius: t.radius.card,
      borderTopRightRadius: t.radius.card,
      backgroundColor: t.colors.background,
    },
    claimLine: { fontSize: 16, fontFamily: t.fonts.regular, color: t.colors.text },
    log: { gap: 2, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8 },
    mySeat: { gap: 10 },
  });
