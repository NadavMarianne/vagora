// A poker table drawn from above: a felt table with a place for every seat (as many as the table's
// most players), your seat at the bottom, and in the middle whose turn, the board, the turn timer
// and the pot. Before you sit down, tapping an empty seat picks it; tapping a player opens their
// page. On each seat's top edge their last action, on its bottom edge their bet; in front of
// each player on the felt, their cards and their chips. The cards are real, so the table only
// shows where they are: outlines with a question mark. Where everything goes is worked out in
// poker-layout.ts, so nothing overlaps.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Reanimated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { POKER } from "@/components/amount-slider";
import { ChipStack } from "@/components/poker-chips";
import {
  BET_H,
  BOARD_CARD,
  BOARD_GAP,
  LABEL_H,
  MIDDLE_GAP,
  MIDDLE_W,
  type Rect,
  RING,
  SEAT_H,
  SEAT_W,
  tableLayout,
  TOP_LINE_H,
  TOP_ROOM,
} from "@/components/poker-layout";
import { Tappable } from "@/components/tappable";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { PokerHand, PokerTable } from "@/lib/types";

const FELT = "#0E6B3C";
const RIM = "#5A3A1F";
const ON_FELT = "#FFFFFF";
const FOLDED = 0.35;
// How many cards are face up in the middle after each betting round.
const BOARD: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5 };

const STREETS: Record<string, string> = {
  preflop: "Before the flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  done: "Hand over",
};

/** An amount in a small space: in full below `from`, otherwise like 16K or 1.5M. */
export function short(amount: number, from = 100_000): string {
  if (amount < from) return amount.toLocaleString();
  if (amount < 1_000_000) return `${Math.floor(amount / 1000)}K`;
  const millions = amount / 1_000_000;
  return `${millions < 10 ? Math.floor(millions * 10) / 10 : Math.floor(millions)}M`;
}

export function PokerTableView({
  table,
  picked,
  onPick,
  onOpenPlayer,
}: {
  table: PokerTable;
  /** The empty seat picked to sit in, before sitting down. */
  picked: number | null;
  onPick: (seat: number) => void;
  /** Tapping a player: opens their page in the market. */
  onOpenPlayer: (username: string) => void;
}) {
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const screen = useWindowDimensions();
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  const n = table.max_players;
  // Your seat at the bottom; otherwise seat 1. Seats go clockwise from there.
  const layout = tableLayout(width, screen.height, n, table.my_seat ?? 0);
  const height = layout.height;

  const pot = hand ? hand.pots.reduce((sum, p) => sum + p.amount, 0) : 0;
  const turnName =
    playing && hand.to_act !== null && !hand.waiting_for_cards
      ? hand.to_act === table.my_seat
        ? "Your turn"
        : `${table.seats.find((s) => s.number === hand.to_act)?.display_name ?? "Someone"}’s turn`
      : null;
  // Whose turn; otherwise the round (or the table's name, before the first hand).
  const topLine = turnName ?? (hand ? STREETS[hand.street] : table.name);
  const boardCards = hand ? boardCount(hand) : 0;
  // The order cards are dealt in: from the seat after the button, round the table.
  const dealOrder = (seat: number) => (hand ? (seat - hand.button - 1 + 2 * n) % n : 0);

  return (
    <View
      style={[styles.area, { height: width > 0 ? layout.areaHeight : 1 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          {/* The felt, with the seats round its edge. */}
          <View
            style={[
              styles.felt,
              {
                left: SEAT_W / 2,
                right: SEAT_W / 2,
                top: TOP_ROOM + SEAT_H / 2,
                height: height - SEAT_H,
                borderRadius: Math.min(width - SEAT_W, height - SEAT_H) / 2,
              },
            ]}
          />

          {/* The middle: the round and whose turn, the board, the timer and the pot. */}
          <View style={[styles.middle, box(layout.middleRect)]} pointerEvents="none">
            <Text style={styles.topLine} numberOfLines={1}>
              {topLine}
            </Text>
            <View style={styles.board}>
              {hand && boardCards > 0
                ? Array.from({ length: boardCards }, (_, i) => (
                    // A new key each hand, so the cards come in again.
                    <CardShape key={`${hand.number}-${i}`} delay={(i < 3 ? i : 0) * 120} />
                  ))
                : // No cards out yet: the round's name in their place, while it's someone's turn.
                  hand &&
                  turnName && <Text style={styles.street}>{STREETS[hand.street]}</Text>}
            </View>
            <View style={styles.timeAndPot}>
              {playing && hand.turn_ends_at && table.turn_seconds ? (
                <Countdown until={hand.turn_ends_at} seconds={table.turn_seconds} />
              ) : playing && hand.waiting_for_cards ? (
                <Reanimated.Text entering={FadeIn} style={styles.dealing}>
                  Dealing…
                </Reanimated.Text>
              ) : null}
              {playing && pot > 0 && (
                <View style={styles.pot}>
                  <ChipStack amount={pot} smallBlind={table.small_blind} size="medium" />
                  <Text style={styles.potLabel}>Pot</Text>
                  <Text style={styles.potAmount} numberOfLines={1}>
                    <CountUp value={pot} format={(v) => short(v, 1_000_000)} />
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* The seats. */}
          {layout.spots.map((spot, number) => {
            const seat = table.seats.find((s) => s.number === number);
            if (!seat) {
              return (
                <Tappable
                  key={`seat-${number}`}
                  disabled={table.my_seat !== null}
                  onPress={() => onPick(number)}
                  accessibilityRole="button"
                  accessibilityLabel={`Seat ${number + 1}`}
                  style={[
                    styles.seat,
                    styles.empty,
                    box(spot.box),
                    picked === number && styles.picked,
                  ]}
                >
                  <Text style={[styles.emptyText, picked === number && styles.pickedText]}>
                    {table.my_seat === null ? (picked === number ? "Your seat" : "Sit here") : ""}
                  </Text>
                  <Text style={styles.note}>Seat {number + 1}</Text>
                </Tappable>
              );
            }
            const inHand = playing ? hand.players.find((p) => p.seat === number) : undefined;
            return (
              <SeatBox
                key={`seat-${number}`}
                spot={spot.box}
                name={number === table.my_seat ? "You" : seat.display_name}
                stack={seat.stack}
                note={seatNote(table, number, inHand)}
                dealer={hand?.button === number ? `${hand.number}` : null}
                mine={number === table.my_seat}
                turn={playing && hand.to_act === number && !hand.waiting_for_cards}
                folded={inHand?.folded ?? false}
                onPress={() => onOpenPlayer(seat.username)}
              />
            );
          })}

          {/* In front of each player: their cards while they're in the hand, and their chips. */}
          {layout.spots.map((spot, number) => {
            const seat = table.seats.find((s) => s.number === number);
            if (!seat) return null;
            const inHand = playing ? hand.players.find((p) => p.seat === number) : undefined;
            return (
              <View
                key={`front-${number}`}
                style={[styles.front, spot.frontTall && styles.frontTall, box(spot.front)]}
                pointerEvents="none"
              >
                {inHand && !inHand.folded && (
                  <Reanimated.View
                    // A new key each hand, so each hand deals them again.
                    key={`cards-${hand?.number}`}
                    entering={ZoomIn.duration(300).delay(dealOrder(number) * 90)}
                    exiting={FadeOut.duration(250)}
                    style={styles.holeCards}
                  >
                    <HoleCard tilt={-8} />
                    <HoleCard tilt={8} />
                  </Reanimated.View>
                )}
                {seat.stack > 0 && <ChipStack amount={seat.stack} smallBlind={table.small_blind} />}
              </View>
            );
          })}

          {/* On each seat's bottom edge: its bet this round, or what it won. */}
          {hand &&
            layout.spots.map((spot, number) => {
              const inHand = playing ? hand.players.find((p) => p.seat === number) : undefined;
              const bet = inHand?.street_bet ?? 0;
              const won = hand.street === "done" ? (hand.payouts[String(number)] ?? 0) : 0;
              if (bet <= 0 && won <= 0) return null;
              return (
                <Reanimated.View
                  // A new key each round, so the next round's bet comes in again.
                  key={`bet-${number}-${hand.number}-${hand.street}`}
                  entering={ZoomIn.duration(250).delay(won > 0 ? 300 : 0)}
                  exiting={FadeOut.duration(200)}
                  style={[styles.betSpot, box(spot.bet)]}
                  pointerEvents="none"
                >
                  <View style={styles.bet}>
                    <ChipStack amount={bet || won} smallBlind={table.small_blind} />
                    <Text style={styles.betText} numberOfLines={1}>
                      {won > 0 ? `+${short(won)}` : short(bet)}
                    </Text>
                  </View>
                </Reanimated.View>
              );
            })}

          {/* On each seat's top edge: what they did last. */}
          {hand &&
            layout.spots.map((spot, number) => {
              const action = table.seats.some((s) => s.number === number)
                ? lastAction(hand, number)
                : null;
              if (!action) return null;
              return (
                <ActionLabel
                  key={`label-${number}-${action.label}`}
                  label={action.label}
                  color={action.color}
                  spot={spot.label}
                />
              );
            })}
        </>
      )}
    </View>
  );
}

/** A rectangle as a style. */
function box(r: Rect) {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}

/** A player's seat: the dealer button and name, the stack, and their blind. Fades when
 * they fold, glows on their turn, and opens their page when tapped. The stack counts up or down
 * when it changes. */
function SeatBox({
  spot,
  name,
  stack,
  note,
  dealer,
  mine,
  turn,
  folded,
  onPress,
}: {
  spot: Rect;
  name: string;
  stack: number;
  note: string;
  /** When they're the dealer: a key for this hand. */
  dealer: string | null;
  mine: boolean;
  turn: boolean;
  folded: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [fade] = useState(() => new Animated.Value(folded ? FOLDED : 1));
  useEffect(() => {
    Animated.timing(fade, {
      toValue: folded ? FOLDED : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [folded, fade]);
  return (
    <Animated.View style={[styles.seatSpot, box(spot), { opacity: fade }]}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${stack}`}
        style={[styles.seat, styles.seatFill, mine && styles.mine, turn && styles.turn]}
      >
        <View style={styles.nameRow}>
          {dealer && (
            <Reanimated.View key={dealer} entering={FadeIn.duration(400)} style={styles.button}>
              <Text style={styles.buttonText}>D</Text>
            </Reanimated.View>
          )}
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={styles.stack} numberOfLines={1}>
          <CountUp value={stack} format={(v) => short(v, 1_000_000)} />
        </Text>
        {note !== "" && (
          <Text style={styles.note} numberOfLines={1}>
            {note}
          </Text>
        )}
      </Tappable>
    </Animated.View>
  );
}

/** A number that counts up or down to its new value instead of jumping. */
function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(value);
  const [motion] = useState(() => new Animated.Value(value));
  useEffect(() => {
    const id = motion.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(motion, {
      toValue: value,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      motion.stopAnimation();
      motion.removeListener(id);
    };
  }, [value, motion]);
  return <>{format(shown)}</>;
}

/** Under a player's stack: small or big blind, or sitting this hand out. */
function seatNote(
  table: PokerTable,
  number: number,
  inHand: { folded: boolean; all_in: boolean } | undefined,
): string {
  const hand = table.hand;
  if (!hand || hand.street === "done") return "";
  if (!inHand) return "next hand";
  if (inHand.folded) return "";
  if (hand.small_blind_seat === number) return "small blind";
  if (hand.big_blind_seat === number) return "big blind";
  return "";
}

function boardCount(hand: PokerHand): number {
  if (hand.street !== "done") return BOARD[hand.street];
  // A hand that ended at a showdown had the whole board out; one everyone folded, only what
  // was dealt by then.
  const showedDown = hand.players.filter((p) => !p.folded).length > 1;
  return showedDown ? 5 : (BOARD[hand.reached] ?? 0);
}

/** A seat's label: what they did last in this round, or folded or all-in for the whole hand,
 * or what they won once it's over. */
function lastAction(hand: PokerHand, seat: number): { label: string; color: string } | null {
  if (hand.street === "done") {
    const won = hand.payouts[String(seat)] ?? 0;
    return won > 0 ? { label: `Won ${short(won, 10_000)}`, color: POKER.gold[0] } : null;
  }
  const player = hand.players.find((p) => p.seat === seat);
  if (!player) return null;
  if (player.folded) return { label: "Fold", color: POKER.fold[0] };
  if (player.all_in) return { label: "All-in", color: POKER.gold[0] };
  const round = hand.log.filter((e) => e.street === hand.street);
  const mine = round.filter((e) => e.seat === seat && !e.action.endsWith("_blind")).at(-1);
  if (!mine) return null;
  const amount = short(mine.amount, 10_000);
  const raisedBefore = round
    .slice(0, round.indexOf(mine))
    .some((e) => e.action === "raise" || e.action === "big_blind");
  const time = mine.timed_out ? " ⏱" : "";
  if (mine.action === "check") return { label: `Check${time}`, color: POKER.check[0] };
  if (mine.action === "call") return { label: `Call ${amount}`, color: POKER.call[0] };
  if (mine.action === "raise") {
    return { label: `${raisedBefore ? "Raise" : "Bet"} ${amount}`, color: POKER.gold[0] };
  }
  return null;
}

/** A colored label on a seat's top edge. It pops in each time it changes. */
function ActionLabel({ label, color, spot }: { label: string; color: string; spot: Rect }) {
  const styles = useStyles(makeStyles);
  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [pop]);
  const dark = color === POKER.gold[0];
  return (
    <View style={[styles.labelSpot, box(spot)]} pointerEvents="none">
      <Animated.View
        style={[
          styles.label,
          { backgroundColor: color, opacity: pop, transform: [{ scale: pop }] },
        ]}
      >
        <Text
          style={[styles.labelText, { color: dark ? POKER.gold[1] : "#FFFFFF" }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

/** One of a player's real cards, lying in front of them: a small outline with a question mark. */
function HoleCard({ tilt }: { tilt: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.holeCard, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <Text style={styles.holeMark}>?</Text>
    </View>
  );
}

/** Where a real card is on the board: a soft white outline with a question mark. It slides in
 * when dealt. */
function CardShape({ delay }: { delay: number }) {
  const styles = useStyles(makeStyles);
  const [arrive] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(arrive, { toValue: 1, duration: 280, delay, useNativeDriver: true }).start();
  }, [arrive, delay]);
  const rise = arrive.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View style={[styles.card, { opacity: arrive, transform: [{ translateY: rise }] }]}>
      <Text style={styles.cardMark}>?</Text>
    </Animated.View>
  );
}

/** A ring that empties as the turn's time runs out, with the seconds left in big numbers.
 * Green, then gold, then red for the last few seconds, which beat. */
function Countdown({ until, seconds }: { until: string; seconds: number }) {
  const styles = useStyles(makeStyles);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Date.parse(until) - now);
  const share = Math.min(1, left / (seconds * 1000));
  const color = share > 0.5 ? POKER.check[0] : left > 5000 ? POKER.gold[0] : POKER.fold[0];
  const radius = RING / 2 - 5;
  const around = 2 * Math.PI * radius;
  // The last five seconds: each one starts a little big and shrinks.
  const beat = left <= 5000 && left > 0 ? 1 + 0.25 * ((left % 1000) / 1000) : 1;
  return (
    <View style={{ width: RING, height: RING }}>
      <Svg width={RING} height={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={7}
          fill="rgba(0,0,0,0.2)"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${around} ${around}`}
          strokeDashoffset={around * (1 - share)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringMiddle]}>
        <Text
          style={[
            styles.seconds,
            { color: left <= 5000 ? POKER.fold[0] : ON_FELT, transform: [{ scale: beat }] },
          ]}
        >
          {Math.ceil(left / 1000)}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    // Reaches a little into the page's margins, for room on narrow phones.
    area: { alignSelf: "stretch", marginHorizontal: -12 },
    felt: {
      position: "absolute",
      backgroundColor: FELT,
      borderWidth: 10,
      borderColor: RIM,
      boxShadow: "inset 0 0 30px rgba(0,0,0,0.45)",
    },
    middle: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      gap: MIDDLE_GAP,
    },
    topLine: {
      maxWidth: MIDDLE_W,
      height: TOP_LINE_H,
      fontSize: 13,
      fontFamily: t.fonts.bold,
      color: ON_FELT,
      textAlign: "center",
    },
    board: { flexDirection: "row", alignItems: "center", gap: BOARD_GAP, height: BOARD_CARD.h },
    street: { fontSize: 13, fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    card: {
      width: BOARD_CARD.w,
      height: BOARD_CARD.h,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.7)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    cardMark: { fontSize: 13, fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    timeAndPot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: RING,
    },
    dealing: { fontSize: 16, fontFamily: t.fonts.bold, color: ON_FELT },
    pot: { alignItems: "center", maxWidth: MIDDLE_W - RING - 6 },
    potLabel: { fontSize: 10, fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    potAmount: { fontSize: 15, fontFamily: t.fonts.bold, color: POKER.gold[0] },
    ringMiddle: { alignItems: "center", justifyContent: "center" },
    seconds: { fontSize: 22, fontFamily: t.fonts.bold },
    seatSpot: { position: "absolute" },
    seat: {
      position: "absolute",
      width: SEAT_W,
      height: SEAT_H,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 4,
    },
    seatFill: { left: 0, top: 0 },
    mine: { borderColor: t.colors.primary },
    turn: {
      borderColor: POKER.gold[0],
      borderWidth: 3,
      boxShadow: `0 0 12px ${POKER.gold[0]}`,
    },
    empty: { borderStyle: "dashed", backgroundColor: "transparent" },
    picked: { borderStyle: "solid", borderColor: POKER.gold[0], backgroundColor: POKER.gold[0] },
    emptyText: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    pickedText: { color: POKER.gold[1] },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: SEAT_W - 10 },
    name: { flexShrink: 1, fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    stack: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.text },
    note: { fontSize: 10, fontFamily: t.fonts.regular, color: t.colors.muted },
    front: {
      position: "absolute",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    frontTall: { flexDirection: "column", gap: 3 },
    holeCards: { flexDirection: "row" },
    holeCard: {
      width: 11,
      height: 16,
      marginHorizontal: -0.5,
      borderRadius: 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.8)",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    holeMark: {
      fontSize: 8,
      lineHeight: 10,
      fontFamily: t.fonts.bold,
      color: "rgba(255,255,255,0.8)",
    },
    button: {
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#999999",
    },
    buttonText: { fontSize: 8, lineHeight: 10, fontFamily: t.fonts.bold, color: "#111111" },
    labelSpot: { position: "absolute", alignItems: "center", justifyContent: "center" },
    label: {
      height: LABEL_H,
      maxWidth: SEAT_W,
      justifyContent: "center",
      paddingHorizontal: 7,
      borderRadius: LABEL_H / 2,
      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
    },
    labelText: { fontSize: 11, fontFamily: t.fonts.bold },
    betSpot: { position: "absolute", alignItems: "center", justifyContent: "center" },
    bet: {
      height: BET_H,
      maxWidth: SEAT_W,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingLeft: 3,
      paddingRight: 7,
      borderRadius: BET_H / 2,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    betText: { fontSize: 12, fontFamily: t.fonts.bold, color: POKER.gold[0] },
  });
