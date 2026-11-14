// A poker table drawn from above: a felt oval with a place for every seat (as many as the table's
// most players), your seat at the bottom, and in the middle the board, the turn timer and the pot.
// Before you sit down, tapping an empty seat picks it; tapping a player opens their page.
// The cards are real, so the table only shows where they are: outlines with a question mark.
// Everything moves: cards fly out from the middle when dealt, the board flips in, bets slide
// into the pot when a round ends, winnings slide to the winner, and whoever's turn it is glows.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeIn, FadeOut, FlipInYRight, Keyframe } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { POKER } from "@/components/amount-slider";
import { ChipStack } from "@/components/poker-chips";
import { Tappable } from "@/components/tappable";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { PokerHand, PokerTable } from "@/lib/types";

const FELT = "#0E6B3C";
const RIM = "#5A3A1F";
const ON_FELT = "#FFFFFF";
const SEAT_W = 84;
const SEAT_H = 58;
const RING = 84;
const HOLE_W = 26;
const HOLE_H = 37;
const BOARD_W = 34;
const BOARD_H = 48;
// Room above the top seat for its cards, and below the bottom seat for its label.
const TOP_ROOM = HOLE_H - 6;
const BOTTOM_ROOM = 12;
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

type Point = { x: number; y: number };

/** Slides something in from `from` (an offset from where it ends up), turning as it comes. */
function flyIn(from: Point, turn: number, duration: number, delay = 0) {
  return new Keyframe({
    0: {
      opacity: 0,
      transform: [{ translateX: from.x }, { translateY: from.y }, { rotate: `${turn}deg` }],
    },
    100: {
      opacity: 1,
      transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }],
      easing: Easing.out(Easing.cubic),
    },
  })
    .duration(duration)
    .delay(delay);
}

/** Slides something away to `to` (an offset from where it is), fading at the end. */
function flyOut(to: Point, duration: number) {
  return new Keyframe({
    0: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
    70: { opacity: 1, transform: [{ translateX: to.x * 0.85 }, { translateY: to.y * 0.85 }] },
    100: { opacity: 0, transform: [{ translateX: to.x }, { translateY: to.y }] },
  }).duration(duration);
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
  const height = Math.round(width * 1.5);
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  const n = table.max_players;
  // Your seat at the bottom; otherwise seat 1. Seats go clockwise from there.
  const bottom = table.my_seat ?? 0;
  const middle = { x: width / 2, y: TOP_ROOM + height / 2 };

  /** Where a seat's middle is. */
  function place(seat: number): Point {
    const angle = Math.PI / 2 + (2 * Math.PI * ((seat - bottom + n) % n)) / n;
    return {
      x: middle.x + ((width - SEAT_W) / 2) * Math.cos(angle),
      y: middle.y + ((height - SEAT_H) / 2) * Math.sin(angle),
    };
  }
  /** A point just inside the table from a seat: past its box edge by `gap`. */
  function inward(seat: number, gap: number): Point {
    const at = place(seat);
    const dx = middle.x - at.x;
    const dy = middle.y - at.y;
    const length = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / length, dy / length];
    const edge = Math.min(
      Math.abs(ux) > 0.01 ? SEAT_W / 2 / Math.abs(ux) : Infinity,
      Math.abs(uy) > 0.01 ? SEAT_H / 2 / Math.abs(uy) : Infinity,
    );
    return { x: at.x + ux * (edge + gap), y: at.y + uy * (edge + gap) };
  }
  const offset = (from: Point, to: Point): Point => ({ x: to.x - from.x, y: to.y - from.y });

  const pot = hand ? hand.pots.reduce((sum, p) => sum + p.amount, 0) : 0;
  const turnName =
    playing && hand.to_act !== null
      ? hand.to_act === table.my_seat
        ? "Your turn"
        : `${table.seats.find((s) => s.number === hand.to_act)?.display_name ?? "Someone"}’s turn`
      : null;
  // The order cards are dealt in: from the seat after the button, round the table.
  const dealOrder = (seat: number) =>
    hand ? (seat - hand.button - 1 + 2 * n) % n : 0;

  const seats = Array.from({ length: n }, (_, number) => {
    const seat = table.seats.find((s) => s.number === number);
    const at = place(number);
    const inHand = playing ? hand.players.find((p) => p.seat === number) : undefined;
    return {
      number,
      seat,
      at,
      inHand,
      box: { left: at.x - SEAT_W / 2, top: at.y - SEAT_H / 2 },
      chipsAt: inward(number, 22),
    };
  });

  return (
    <View
      style={[styles.area, { height: TOP_ROOM + height + BOTTOM_ROOM || 1 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <View
            style={[
              styles.felt,
              {
                left: SEAT_W * 0.3,
                right: SEAT_W * 0.3,
                top: TOP_ROOM + SEAT_H * 0.35,
                bottom: BOTTOM_ROOM + SEAT_H * 0.35,
                borderRadius: width,
              },
            ]}
          />

          {/* The middle: the round, the board, the timer, the pot and whose turn. */}
          <View style={[styles.middle, { top: TOP_ROOM, height }]} pointerEvents="none">
            {hand && <Text style={styles.street}>{STREETS[hand.street]}</Text>}
            {hand && boardCount(hand) > 0 && (
              <View style={styles.board}>
                {Array.from({ length: boardCount(hand) }, (_, i) => (
                  // A new key each hand, so the cards come in again.
                  <Reanimated.View
                    key={`${hand.number}-${i}`}
                    entering={FlipInYRight.duration(450).delay((i < 3 ? i : 0) * 150)}
                  >
                    <CardShape width={BOARD_W} height={BOARD_H} />
                  </Reanimated.View>
                ))}
              </View>
            )}
            {playing && hand.turn_ends_at && table.turn_seconds ? (
              <Countdown until={hand.turn_ends_at} seconds={table.turn_seconds} />
            ) : playing && hand.waiting_for_cards ? (
              <Reanimated.Text entering={FadeIn} style={styles.dealing}>
                Dealing…
              </Reanimated.Text>
            ) : null}
            {playing && pot > 0 && (
              <View style={styles.potRow}>
                <ChipStack amount={pot} smallBlind={table.small_blind} />
                <Text style={styles.pot}>
                  <CountUp value={pot} />
                </Text>
              </View>
            )}
            {turnName && !hand?.waiting_for_cards && (
              <Text style={styles.turnName}>{turnName}</Text>
            )}
            {!hand && <Text style={styles.turnName}>{table.name}</Text>}
          </View>

          {/* Bets in front of each player. A round's bets slide into the pot when it ends. */}
          {seats.map(({ number, at, inHand, chipsAt }) => {
            const bet = inHand?.street_bet ?? 0;
            if (!hand || bet <= 0) return null;
            return (
              <Reanimated.View
                key={`bet-${number}-${hand.number}-${hand.street}`}
                entering={flyIn(offset(chipsAt, at), 0, 350)}
                exiting={flyOut(offset(chipsAt, middle), 500)}
                style={[styles.chips, { left: chipsAt.x - 40, top: chipsAt.y - 16 }]}
                pointerEvents="none"
              >
                <ChipStack amount={bet} smallBlind={table.small_blind} />
                <Text style={styles.chipsText}>{bet.toLocaleString()}</Text>
              </Reanimated.View>
            );
          })}

          {/* Winnings slide from the pot to each winner, and into their stack at the next deal. */}
          {hand?.street === "done" &&
            seats.map(({ number, at, chipsAt }) => {
              const won = hand.payouts[String(number)] ?? 0;
              if (won <= 0) return null;
              return (
                <Reanimated.View
                  key={`won-${number}-${hand.number}`}
                  entering={flyIn(offset(chipsAt, middle), 0, 650, 250)}
                  exiting={flyOut(offset(chipsAt, at), 450)}
                  style={[styles.chips, { left: chipsAt.x - 40, top: chipsAt.y - 16 }]}
                  pointerEvents="none"
                >
                  <ChipStack amount={won} smallBlind={table.small_blind} />
                  <Text style={styles.chipsText}>+{won.toLocaleString()}</Text>
                </Reanimated.View>
              );
            })}

          {/* The seats. */}
          {seats.map(({ number, seat, inHand, box }) =>
            seat ? (
              <SeatBox
                key={`seat-${number}`}
                style={box}
                name={number === table.my_seat ? "You" : seat.display_name}
                stack={seat.stack}
                note={seatNote(table, number, inHand)}
                mine={number === table.my_seat}
                turn={playing && hand.to_act === number && !hand.waiting_for_cards}
                folded={inHand?.folded ?? false}
                onPress={() => onOpenPlayer(seat.username)}
              />
            ) : (
              <Tappable
                key={`seat-${number}`}
                disabled={table.my_seat !== null}
                onPress={() => onPick(number)}
                accessibilityRole="button"
                accessibilityLabel={`Seat ${number + 1}`}
                style={[styles.seat, styles.empty, box, picked === number && styles.picked]}
              >
                <Text style={[styles.emptyText, picked === number && styles.pickedText]}>
                  {table.my_seat === null ? (picked === number ? "Your seat" : "Sit here") : ""}
                </Text>
                <Text style={styles.note}>Seat {number + 1}</Text>
              </Tappable>
            ),
          )}

          {/* Each player's two cards, fanned above their seat, dealt out from the middle. */}
          {seats.map(({ number, at, inHand, box }) => {
            if (!hand || !inHand || inHand.folded) return null;
            const spot = { x: at.x, y: box.top - HOLE_H / 2 + 8 };
            const from = offset(spot, middle);
            const order = dealOrder(number);
            return (
              <Reanimated.View
                key={`cards-${number}-${hand.number}`}
                exiting={FadeOut.duration(300)}
                style={[styles.hole, { left: spot.x - HOLE_W * 0.78, top: spot.y - HOLE_H / 2 }]}
                pointerEvents="none"
              >
                {[-9, 9].map((tilt, i) => (
                  <Reanimated.View
                    key={tilt}
                    entering={flyIn(from, 180, 500, (order + i * n) * 70)}
                    style={{
                      transform: [{ rotate: `${tilt}deg` }],
                      marginLeft: i === 0 ? 0 : -HOLE_W * 0.45,
                    }}
                  >
                    <CardShape width={HOLE_W} height={HOLE_H} />
                  </Reanimated.View>
                ))}
              </Reanimated.View>
            );
          })}

          {/* The dealer button, and each player's last action under their seat. */}
          {seats.map(({ number, seat, box }) => {
            const action = seat && hand ? lastAction(hand, number) : null;
            return (
              <View key={`marks-${number}`} style={StyleSheet.absoluteFill} pointerEvents="none">
                {hand?.button === number && seat && (
                  <Reanimated.View
                    key={`button-${hand.number}`}
                    entering={FadeIn.duration(400)}
                    style={[styles.button, { left: box.left + SEAT_W - 14, top: box.top - 8 }]}
                  >
                    <Text style={styles.buttonText}>D</Text>
                  </Reanimated.View>
                )}
                {action && (
                  <ActionLabel
                    key={action.label}
                    label={action.label}
                    color={action.color}
                    left={box.left}
                    top={box.top + SEAT_H - 10}
                  />
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

/** A player's seat: name, stack and note. Glows and breathes on their turn, fades when they fold,
 * and opens their page when tapped. The stack counts up or down when it changes. */
function SeatBox({
  style,
  name,
  stack,
  note,
  mine,
  turn,
  folded,
  onPress,
}: {
  style: { left: number; top: number };
  name: string;
  stack: number;
  note: string;
  mine: boolean;
  turn: boolean;
  folded: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [fade] = useState(() => new Animated.Value(folded ? 0.35 : 1));
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fade, {
      toValue: folded ? 0.35 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [folded, fade]);

  useEffect(() => {
    if (!turn) {
      glow.stopAnimation();
      Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [turn, glow]);

  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <Animated.View
      style={[styles.seatSpot, style, { opacity: fade, transform: [{ scale: turn ? scale : 1 }] }]}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${stack}`}
        style={[styles.seat, styles.seatInner, mine && styles.mine, turn && styles.turn]}
      >
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.stack}>
          <CountUp value={stack} />
        </Text>
        <Text style={styles.note} numberOfLines={1}>
          {note}
        </Text>
      </Tappable>
    </Animated.View>
  );
}

/** A number that counts up or down to its new value instead of jumping. */
function CountUp({ value }: { value: number }) {
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
    return () => motion.removeListener(id);
  }, [value, motion]);
  return <>{shown.toLocaleString()}</>;
}

/** Where a real card is: a soft white outline with a question mark. */
function CardShape({ width, height }: { width: number; height: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.card, { width, height, borderRadius: width * 0.16 }]}>
      <Text style={[styles.cardMark, { fontSize: height * 0.4 }]}>?</Text>
    </View>
  );
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
    return won > 0 ? { label: `Won ${won.toLocaleString()}`, color: POKER.gold[0] } : null;
  }
  const player = hand.players.find((p) => p.seat === seat);
  if (!player) return null;
  if (player.folded) return { label: "Fold", color: POKER.fold[0] };
  if (player.all_in) return { label: "All-in", color: POKER.gold[0] };
  const round = hand.log.filter((e) => e.street === hand.street);
  const mine = round.filter((e) => e.seat === seat && !e.action.endsWith("_blind")).at(-1);
  if (!mine) return null;
  const amount = mine.amount.toLocaleString();
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

/** A colored label under a seat. It pops in each time it changes. */
function ActionLabel({
  label,
  color,
  left,
  top,
}: {
  label: string;
  color: string;
  left: number;
  top: number;
}) {
  const styles = useStyles(makeStyles);
  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [pop]);
  const dark = color === POKER.gold[0];
  return (
    <View style={[styles.labelSpot, { left, top }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.label,
          { backgroundColor: color, opacity: pop, transform: [{ scale: pop }] },
        ]}
      >
        <Text style={[styles.labelText, { color: dark ? POKER.gold[1] : "#FFFFFF" }]}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

/** A ring that empties as the turn's time runs out, with the seconds left in big numbers.
 * Green, then gold, then red for the last few seconds. */
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
  const radius = RING / 2 - 6;
  const around = 2 * Math.PI * radius;
  return (
    <View style={{ width: RING, height: RING }}>
      <Svg width={RING} height={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={8}
          fill="rgba(0,0,0,0.2)"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${around} ${around}`}
          strokeDashoffset={around * (1 - share)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringMiddle]}>
        {/* The last five seconds beat: each one starts big and shrinks. */}
        <Text
          style={[
            styles.seconds,
            { color: left <= 5000 ? POKER.fold[0] : ON_FELT },
            left <= 5000 && left > 0 && { transform: [{ scale: 1 + 0.3 * ((left % 1000) / 1000) }] },
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
    area: { width: "100%" },
    felt: {
      position: "absolute",
      backgroundColor: FELT,
      borderWidth: 10,
      borderColor: RIM,
      boxShadow: "inset 0 0 30px rgba(0,0,0,0.45)",
    },
    middle: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: SEAT_W * 0.8,
    },
    street: { fontSize: 13, fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    board: { flexDirection: "row", gap: 4 },
    card: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.75)",
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    cardMark: { fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    hole: { position: "absolute", flexDirection: "row", width: HOLE_W * 1.6 },
    dealing: { fontSize: 20, fontFamily: t.fonts.bold, color: ON_FELT },
    potRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    pot: { fontSize: 20, fontFamily: t.fonts.bold, color: POKER.gold[0] },
    turnName: {
      fontSize: 15,
      fontFamily: t.fonts.bold,
      color: ON_FELT,
      textAlign: "center",
    },
    ringMiddle: { alignItems: "center", justifyContent: "center" },
    seconds: { fontSize: 30, fontFamily: t.fonts.bold },
    chips: { position: "absolute", width: 80, alignItems: "center", gap: 1 },
    chipsText: {
      fontSize: 11,
      fontFamily: t.fonts.bold,
      color: POKER.gold[0],
      paddingHorizontal: 5,
      borderRadius: 7,
      backgroundColor: "rgba(0,0,0,0.45)",
      overflow: "hidden",
    },
    seatSpot: { position: "absolute", width: SEAT_W, height: SEAT_H },
    glow: {
      position: "absolute",
      top: -4,
      bottom: -4,
      left: -4,
      right: -4,
      borderRadius: 16,
      backgroundColor: "rgba(232,185,35,0.35)",
      boxShadow: `0 0 18px ${POKER.gold[0]}`,
    },
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
    seatInner: { left: 0, top: 0 },
    mine: { borderColor: t.colors.primary },
    turn: { borderColor: POKER.gold[0], borderWidth: 3 },
    empty: { borderStyle: "dashed", backgroundColor: "transparent" },
    picked: { borderStyle: "solid", borderColor: POKER.gold[0], backgroundColor: POKER.gold[0] },
    emptyText: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    pickedText: { color: POKER.gold[1] },
    name: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    stack: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.text },
    note: { fontSize: 10, fontFamily: t.fonts.regular, color: t.colors.muted },
    labelSpot: { position: "absolute", width: SEAT_W, alignItems: "center" },
    label: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
    },
    labelText: { fontSize: 11, fontFamily: t.fonts.bold },
    button: {
      position: "absolute",
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#999999",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    },
    buttonText: { fontSize: 12, fontFamily: t.fonts.bold, color: "#111111" },
  });
