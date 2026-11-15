// A poker table drawn from above: a felt table with a place for every seat (as many as the table's
// most players), your seat at the bottom, and in the middle whose turn, the board, the turn timer
// and the pot. Before you sit down, tapping an empty seat picks it; tapping a player opens their
// page. On each seat's top edge their last action, on its bottom edge their bet; in front of
// each player on the felt, their cards and their chips. The cards are real, so the table only
// shows where they are: outlines with a question mark. Where everything goes is worked out in
// poker-layout.ts, so nothing overlaps, and the whole table is drawn as big as its space allows.
// Chips move where they go: from a player's pile to their bet, from the bets to the pot when a
// round ends, and from the pot to the winner.
import { createContext, useContext, useEffect, useId, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Reanimated, {
  Easing as ReEasing,
  FadeIn,
  FadeOut,
  Keyframe,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, Path, Rect as SvgRect } from "react-native-svg";

import { POKER } from "@/components/amount-slider";
import { ChipStack } from "@/components/poker-chips";
import {
  BET_H,
  BOARD_CARD,
  BOARD_GAP,
  fitTable,
  LABEL_H,
  MIDDLE_GAP,
  MIDDLE_W,
  type Rect,
  RIM_W,
  RING,
  SEAT_H,
  SEAT_W,
  TOP_LINE_H,
} from "@/components/poker-layout";
import { Tappable } from "@/components/tappable";
import { useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { PokerHand, PokerTable } from "@/lib/types";

const FELT = "#0E6B3C";
const RIM = "#5A3A1F";
const ON_FELT = "#FFFFFF";
const FOLDED = 0.35;
// How many cards are face up in the middle after each betting round.
const BOARD: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5 };

const STREETS: Record<string, string> = {
  preflop: "Pre-flop",
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

type Point = { x: number; y: number };

/** How many times its normal size the table is drawn, for every part of it. */
const Scale = createContext(1);

/** The table's styles at its size. */
function useTableStyles() {
  const t = useTheme();
  const scale = useContext(Scale);
  return useMemo(() => makeStyles(t, scale), [t, scale]);
}

/** How long chips take to fly to a bet. */
const FLIGHT = 450;

/** The middle of a rectangle. */
function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
/** How to get from one point to another. */
function offset(from: Point, to: Point): Point {
  return { x: to.x - from.x, y: to.y - from.y };
}

/** Comes in from `from` (an offset from where it ends up). Keyframes run on the UI thread, so
 * they take Reanimated's Easing. */
function arrive(from: Point, duration: number, delay = 0) {
  return new Keyframe({
    0: { opacity: 0.6, transform: [{ translateX: from.x }, { translateY: from.y }] },
    100: {
      opacity: 1,
      transform: [{ translateX: 0 }, { translateY: 0 }],
      easing: ReEasing.out(ReEasing.cubic),
    },
  })
    .duration(duration)
    .delay(delay);
}

/** Goes away to `to` (an offset from where it is), fading at the very end. */
function leave(to: Point, duration: number) {
  return new Keyframe({
    0: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
    85: { opacity: 1, transform: [{ translateX: to.x }, { translateY: to.y }] },
    100: { opacity: 0, transform: [{ translateX: to.x }, { translateY: to.y }] },
  }).duration(duration);
}

/** Chips flying in from `from` and vanishing as they land (where the bet then shows). It ends
 * see-through, which is also how it's drawn, so it stays hidden afterwards. */
function flight(from: Point) {
  return new Keyframe({
    0: { opacity: 1, transform: [{ translateX: from.x }, { translateY: from.y }] },
    90: {
      opacity: 1,
      transform: [{ translateX: 0 }, { translateY: 0 }],
      easing: ReEasing.out(ReEasing.quad),
    },
    100: { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] },
  }).duration(FLIGHT);
}

export function PokerTableView({
  table,
  picked,
  onPick,
  onOpenPlayer,
  fill = false,
}: {
  table: PokerTable;
  /** The empty seat picked to sit in, before sitting down. */
  picked: number | null;
  onPick: (seat: number) => void;
  /** Tapping a player: opens their page in the market. */
  onOpenPlayer: (username: string) => void;
  /** Fill the space it's given (else it takes about half the screen). */
  fill?: boolean;
}) {
  const t = useTheme();
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const screen = useWindowDimensions();
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  const n = table.max_players;
  const bottomSeat = table.my_seat ?? 0;
  const boxWidth = space.width;
  const boxHeight = fill
    ? space.height
    : Math.min(space.width * 1.3, screen.height * 0.55);
  // Your seat at the bottom; otherwise seat 1. Seats go clockwise from there.
  const fitted = useMemo(
    () => fitTable(boxWidth, boxHeight, n, bottomSeat),
    [boxWidth, boxHeight, n, bottomSeat],
  );
  // Everything below is in points on the screen, already at the table's size.
  const { layout, scale } = fitted;
  const styles = useMemo(() => makeStyles(t, scale), [t, scale]);
  const ready = boxWidth > 0 && boxHeight > 0;

  // Like at a real table, this round's bets stay in front of the players; the pot only holds what
  // was gathered at the end of earlier rounds. It changes once the bets have flown in.
  const gathered = hand
    ? hand.pots.reduce((sum, p) => sum + p.amount, 0) -
      hand.players.reduce((sum, p) => sum + p.street_bet, 0)
    : 0;
  const pot = useLater(gathered, FLIGHT);
  const turnName =
    playing && hand.to_act !== null && !hand.waiting_for_cards
      ? hand.to_act === table.my_seat
        ? "Your turn"
        : `${table.seats.find((s) => s.number === hand.to_act)?.display_name ?? "Someone"}’s turn`
      : null;
  // Whose turn; otherwise the round (or the table's name, before the first hand).
  const topLine = turnName ?? (hand ? STREETS[hand.street] : table.name);
  const boardCards = hand ? boardCount(hand) : 0;
  /** The hand's player in a seat, if whoever played it is still sitting there (someone who got
   * up, or someone new in their seat, shows none of the hand). */
  const playerAt = (number: number) =>
    hand?.players.find((p) => p.seat === number && p.still_here !== false);
  // The order cards are dealt in: from the seat after the button, round the table.
  const dealOrder = (seat: number) => (hand ? (seat - hand.button - 1 + 2 * n) % n : 0);

  return (
    <View
      style={[styles.area, fill ? styles.fill : { height: ready ? layout.areaHeight : 1 }]}
      onLayout={(e) =>
        setSpace({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      {ready && (
        // The table, in the middle of its space.
        <Scale.Provider value={scale}>
        <View
          style={{
            position: "absolute",
            width: layout.width,
            height: layout.areaHeight,
            left: (boxWidth - layout.width) / 2,
            top: ((fill ? boxHeight : layout.areaHeight) - layout.areaHeight) / 2,
          }}
        >
          {/* The felt, with the seats round its edge. */}
          <View style={[styles.felt, box(layout.felt), { borderRadius: layout.feltRadius }]} />

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
                  <ChipStack
                    amount={pot}
                    smallBlind={table.small_blind}
                    size="medium"
                    stacks={3}
                    scale={scale}
                  />
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
            const inHand = playing ? playerAt(number) : undefined;
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
            const inHand = playing ? playerAt(number) : undefined;
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
                {seat.stack > 0 && (
                  <ChipStack
                    amount={seat.stack}
                    smallBlind={table.small_blind}
                    stacks={spot.frontTall ? 2 : 3}
                    scale={scale}
                  />
                )}
              </View>
            );
          })}

          {/* Each time a player puts chips in, a pile flies from their chips to their bet. */}
          {playing &&
            layout.spots.map((spot, number) => {
              const bet = playerAt(number)?.street_bet ?? 0;
              if (bet <= 0) return null;
              return (
                <Reanimated.View
                  key={`fly-${number}-${hand.number}-${hand.street}-${bet}`}
                  entering={flight(offset(center(spot.bet), center(spot.front)))}
                  style={[styles.betSpot, styles.flying, box(spot.bet)]}
                  pointerEvents="none"
                >
                  <ChipStack
                    amount={bet}
                    smallBlind={table.small_blind}
                    shape="tower"
                    scale={scale}
                    still
                  />
                </Reanimated.View>
              );
            })}

          {/* On each seat's bottom edge: its bet this round, which goes to the pot when the round
              ends; or what it won, which comes from the pot and goes on to their chips. */}
          {hand &&
            layout.spots.map((spot, number) => {
              const inHand = playing ? playerAt(number) : undefined;
              const bet = inHand?.street_bet ?? 0;
              const won =
                hand.street === "done" && playerAt(number) ? (hand.payouts[String(number)] ?? 0) : 0;
              if (bet <= 0 && won <= 0) return null;
              const at = center(spot.bet);
              return (
                <Reanimated.View
                  // A new key each round, so the next round's bet comes in again.
                  key={`bet-${number}-${hand.number}-${hand.street}`}
                  entering={
                    won > 0
                      ? arrive(offset(at, layout.middle), 600, FLIGHT)
                      : ZoomIn.duration(150).delay(FLIGHT - 50)
                  }
                  exiting={
                    won > 0
                      ? leave(offset(at, center(spot.front)), 500)
                      : leave(offset(at, layout.middle), FLIGHT)
                  }
                  style={[styles.betSpot, box(spot.bet)]}
                  pointerEvents="none"
                >
                  <View style={styles.bet}>
                    <ChipStack
                      amount={bet || won}
                      smallBlind={table.small_blind}
                      shape="tower"
                      scale={scale}
                    />
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
              const action =
                table.seats.some((s) => s.number === number) && playerAt(number)
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
        </View>
        </Scale.Provider>
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
  const styles = useTableStyles();
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

/** A value that follows another `wait` milliseconds later, like the pot once the bets land. */
function useLater<T>(value: T, wait: number): T {
  const [later, setLater] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setLater(value), wait);
    return () => clearTimeout(timer);
  }, [value, wait]);
  return later;
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
  const styles = useTableStyles();
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
  const styles = useTableStyles();
  return (
    <View style={[styles.holeCard, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <Text style={styles.holeMark}>?</Text>
    </View>
  );
}

/** Where a real card is on the board: a soft white outline with a question mark. It slides in
 * when dealt. */
function CardShape({ delay }: { delay: number }) {
  const styles = useTableStyles();
  const scale = useContext(Scale);
  const [arrive] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(arrive, { toValue: 1, duration: 280, delay, useNativeDriver: true }).start();
  }, [arrive, delay]);
  const rise = arrive.interpolate({ inputRange: [0, 1], outputRange: [10 * scale, 0] });
  return (
    <Animated.View style={[styles.card, { opacity: arrive, transform: [{ translateY: rise }] }]}>
      <Text style={styles.cardMark}>?</Text>
    </Animated.View>
  );
}

/** Sand, drawn so its top edge can move smoothly on the UI thread. */
const SandRect = Reanimated.createAnimatedComponent(SvgRect);

/** An hourglass whose sand runs from the top to the bottom as the turn's time runs out, smoothly,
 * with the time left over it in digits. The sand reddens and the digits beat in the last five
 * seconds. */
function Countdown({ until, seconds }: { until: string; seconds: number }) {
  const styles = useTableStyles();
  const h = RING * useContext(Scale);
  const w = h * 0.72;
  // An id for this hourglass's shapes, so two on a screen don't mix.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  // The digits and colors: four times a second is plenty.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Date.parse(until) - now);
  const secondsLeft = Math.ceil(left / 1000);
  const late = left <= 5000;
  const sandColor = late ? "#E05A47" : left > (seconds * 1000) / 2 ? "#EBC970" : "#E7A84A";

  // The sand: how much is still on top, from now to empty at the deadline, in one smooth run.
  const sand = useSharedValue(1);
  useEffect(() => {
    const leftNow = Math.max(0, Date.parse(until) - Date.now());
    sand.set(Math.min(1, leftNow / (seconds * 1000)));
    sand.set(withTiming(0, { duration: leftNow, easing: ReEasing.linear }));
  }, [until, seconds, sand]);

  // The glass, between a wooden cap at the top and one at the bottom.
  const cap = h * 0.08;
  const top = cap;
  const bottom = h - cap;
  const mid = h / 2;
  const cx = w / 2;
  const [left0, right0] = [w * 0.14, w * 0.86];
  const neck = w * 0.06;
  const bulb = (from: number) => {
    const bend = from + (mid - from) * 0.55;
    return `M${left0} ${from} L${right0} ${from} C${right0} ${bend} ${cx + neck} ${mid} ${cx + neck} ${mid} L${cx - neck} ${mid} C${cx - neck} ${mid} ${left0} ${bend} ${left0} ${from} Z`;
  };
  const topBulb = bulb(top);
  const bottomBulb = bulb(bottom);
  const room = mid - top - 1;
  const topSand = useAnimatedProps(() => {
    const height = room * sand.value;
    return { y: mid - height, height };
  });
  const bottomSand = useAnimatedProps(() => {
    const height = room * (1 - sand.value) * 0.9;
    return { y: bottom - height, height };
  });
  const stream = useAnimatedProps(() => ({
    opacity: sand.value > 0.002 && sand.value < 0.998 ? 1 : 0,
    height: Math.max(0, bottom - mid - room * (1 - sand.value) * 0.9),
  }));
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <ClipPath id={`top${id}`}>
            <Path d={topBulb} />
          </ClipPath>
          <ClipPath id={`bottom${id}`}>
            <Path d={bottomBulb} />
          </ClipPath>
        </Defs>
        {/* The glass. */}
        <Path d={topBulb} fill="rgba(255,255,255,0.1)" />
        <Path d={bottomBulb} fill="rgba(255,255,255,0.1)" />
        {/* The sand: on top, falling through the neck, and piling up below. */}
        <G clipPath={`url(#top${id})`}>
          <SandRect x={0} width={w} fill={sandColor} animatedProps={topSand} />
        </G>
        <SandRect x={cx - w * 0.02} y={mid} width={w * 0.04} fill={sandColor} animatedProps={stream} />
        <G clipPath={`url(#bottom${id})`}>
          <SandRect x={0} width={w} fill={sandColor} animatedProps={bottomSand} />
        </G>
        <Path d={topBulb} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={h * 0.025} />
        <Path d={bottomBulb} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={h * 0.025} />
        {/* The wooden caps. */}
        <SvgRect x={0} y={0} width={w} height={cap} rx={cap / 2} fill="#7A4E2A" />
        <SvgRect x={0} y={bottom} width={w} height={cap} rx={cap / 2} fill="#7A4E2A" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringMiddle]}>
        <Text
          style={[
            styles.seconds,
            late && styles.secondsLate,
            // The last five seconds: each one starts a little big and shrinks.
            late && left > 0 && { transform: [{ scale: 1 + 0.25 * ((left % 1000) / 1000) }] },
          ]}
        >
          {`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme, scale: number) => {
  /** A size at the table's size. */
  const u = (n: number) => n * scale;
  return StyleSheet.create({
    // Reaches a little into the page's margins, for room on narrow phones.
    area: { alignSelf: "stretch", marginHorizontal: -12 },
    fill: { flex: 1, marginHorizontal: 0 },
    flying: { opacity: 0 },
    felt: {
      position: "absolute",
      backgroundColor: FELT,
      borderWidth: u(RIM_W),
      borderColor: RIM,
      boxShadow: `inset 0 0 ${u(30)}px rgba(0,0,0,0.45)`,
    },
    middle: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      gap: u(MIDDLE_GAP),
    },
    topLine: {
      maxWidth: u(MIDDLE_W),
      height: u(TOP_LINE_H),
      fontSize: u(13),
      fontFamily: t.fonts.bold,
      color: ON_FELT,
      textAlign: "center",
    },
    board: { flexDirection: "row", alignItems: "center", gap: u(BOARD_GAP), height: u(BOARD_CARD.h) },
    street: { fontSize: u(13), fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    card: {
      width: u(BOARD_CARD.w),
      height: u(BOARD_CARD.h),
      borderRadius: u(4),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: u(1.5),
      borderColor: "rgba(255,255,255,0.7)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    cardMark: { fontSize: u(13), fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    timeAndPot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: u(6),
      height: u(RING),
    },
    dealing: { fontSize: u(16), fontFamily: t.fonts.bold, color: ON_FELT },
    pot: { alignItems: "center", maxWidth: u(MIDDLE_W - RING - 6) },
    potLabel: { fontSize: u(10), fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    potAmount: { fontSize: u(15), fontFamily: t.fonts.bold, color: POKER.gold[0] },
    ringMiddle: { alignItems: "center", justifyContent: "center" },
    // The time over the hourglass, in digits on a dark pill so it reads over the sand.
    seconds: {
      fontSize: u(15),
      fontFamily: t.fonts.bold,
      fontVariant: ["tabular-nums"],
      color: ON_FELT,
      paddingHorizontal: u(5),
      borderRadius: u(6),
      backgroundColor: "rgba(0,0,0,0.6)",
      overflow: "hidden",
    },
    secondsLate: { color: "#FF6B5B" },
    seatSpot: { position: "absolute" },
    seat: {
      position: "absolute",
      width: u(SEAT_W),
      height: u(SEAT_H),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: u(12),
      borderWidth: u(2),
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingHorizontal: u(4),
      // A little more room under the text than over it.
      paddingBottom: u(3),
    },
    seatFill: { left: 0, top: 0 },
    mine: { borderColor: t.colors.primary },
    turn: {
      borderColor: POKER.gold[0],
      borderWidth: u(3),
      boxShadow: `0 0 ${u(12)}px ${POKER.gold[0]}`,
    },
    empty: { borderStyle: "dashed", backgroundColor: "transparent" },
    picked: { borderStyle: "solid", borderColor: POKER.gold[0], backgroundColor: POKER.gold[0] },
    emptyText: { fontSize: u(13), fontFamily: t.fonts.bold, color: t.colors.text },
    pickedText: { color: POKER.gold[1] },
    nameRow: { flexDirection: "row", alignItems: "center", gap: u(3), maxWidth: u(SEAT_W - 10) },
    // Fixed line heights (and no extra font padding on Android), so the three lines always fit
    // inside the seat with room under the last one.
    name: {
      flexShrink: 1,
      fontSize: u(13),
      lineHeight: u(16),
      includeFontPadding: false,
      fontFamily: t.fonts.bold,
      color: t.colors.text,
    },
    stack: {
      fontSize: u(15),
      lineHeight: u(19),
      includeFontPadding: false,
      fontFamily: t.fonts.bold,
      color: t.colors.text,
    },
    note: {
      fontSize: u(10),
      lineHeight: u(13),
      includeFontPadding: false,
      fontFamily: t.fonts.regular,
      color: t.colors.muted,
    },
    front: {
      position: "absolute",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: u(4),
    },
    frontTall: { flexDirection: "column", gap: u(3) },
    holeCards: { flexDirection: "row" },
    holeCard: {
      width: u(11),
      height: u(16),
      marginHorizontal: u(-0.5),
      borderRadius: u(2),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: u(1),
      borderColor: "rgba(255,255,255,0.8)",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    holeMark: {
      fontSize: u(8),
      lineHeight: u(10),
      fontFamily: t.fonts.bold,
      color: "rgba(255,255,255,0.8)",
    },
    button: {
      width: u(14),
      height: u(14),
      borderRadius: u(7),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: u(1),
      borderColor: "#999999",
    },
    buttonText: { fontSize: u(8), lineHeight: u(10), fontFamily: t.fonts.bold, color: "#111111" },
    labelSpot: { position: "absolute", alignItems: "center", justifyContent: "center" },
    label: {
      height: u(LABEL_H),
      maxWidth: u(SEAT_W),
      justifyContent: "center",
      paddingHorizontal: u(7),
      borderRadius: u(LABEL_H / 2),
      boxShadow: `0 ${u(1)}px ${u(4)}px rgba(0,0,0,0.35)`,
    },
    labelText: { fontSize: u(11), fontFamily: t.fonts.bold },
    betSpot: { position: "absolute", alignItems: "center", justifyContent: "center" },
    bet: {
      height: u(BET_H),
      maxWidth: u(SEAT_W),
      flexDirection: "row",
      alignItems: "center",
      gap: u(3),
      paddingLeft: u(3),
      paddingRight: u(7),
      borderRadius: u(BET_H / 2),
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    betText: { fontSize: u(12), fontFamily: t.fonts.bold, color: POKER.gold[0] },
  });
};
