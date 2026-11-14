// A poker table drawn from above: a felt oval with a place for every seat (as many as the table's
// most players), your seat at the bottom, and in the middle the pot and a big turn timer.
// Before you sit down, tapping an empty seat picks it.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { POKER } from "@/components/amount-slider";
import { Tappable } from "@/components/tappable";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { PokerTable } from "@/lib/types";

const FELT = "#0E6B3C";
const RIM = "#5A3A1F";
const ON_FELT = "#FFFFFF";
const SEAT_W = 80;
const SEAT_H = 60;
const RING = 92;

const STREETS: Record<string, string> = {
  preflop: "Before the flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  done: "Hand over",
};

export function PokerTableView({
  table,
  picked,
  onPick,
}: {
  table: PokerTable;
  /** The empty seat picked to sit in, before sitting down. */
  picked: number | null;
  onPick: (seat: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const height = Math.round(width * 1.25);
  const hand = table.hand;
  const playing = hand !== null && hand.street !== "done";
  const n = table.max_players;
  // Your seat at the bottom; otherwise seat 1. Seats go clockwise from there.
  const bottom = table.my_seat ?? 0;

  /** Where a seat's middle is, and a point between it and the table's middle (for its bet). */
  function place(seat: number, toward = 1) {
    const angle = Math.PI / 2 + (2 * Math.PI * ((seat - bottom + n) % n)) / n;
    const rx = (width - SEAT_W) / 2;
    const ry = (height - SEAT_H) / 2;
    return {
      x: width / 2 + rx * toward * Math.cos(angle),
      y: height / 2 + ry * toward * Math.sin(angle),
    };
  }

  const pot = hand ? hand.pots.reduce((sum, p) => sum + p.amount, 0) : 0;
  const turnName =
    playing && hand.to_act !== null
      ? hand.to_act === table.my_seat
        ? "Your turn"
        : `${table.seats.find((s) => s.number === hand.to_act)?.display_name ?? "Someone"}’s turn`
      : null;

  return (
    <View
      style={[styles.area, { height: height || 1 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <View
            style={[
              styles.felt,
              {
                left: SEAT_W * 0.35,
                right: SEAT_W * 0.35,
                top: SEAT_H * 0.4,
                bottom: SEAT_H * 0.4,
                borderRadius: width,
              },
            ]}
          />

          {/* The middle: the pot, the round, whose turn, and the timer. */}
          <View style={styles.middle} pointerEvents="none">
            {hand && <Text style={styles.street}>{STREETS[hand.street]}</Text>}
            {playing && hand.turn_ends_at && table.turn_seconds ? (
              <Countdown until={hand.turn_ends_at} seconds={table.turn_seconds} />
            ) : playing && hand.waiting_for_cards ? (
              <Text style={styles.dealing}>Dealing…</Text>
            ) : null}
            {playing && <Text style={styles.pot}>Pot {pot.toLocaleString()}</Text>}
            {turnName && !hand?.waiting_for_cards && (
              <Text style={styles.turnName}>{turnName}</Text>
            )}
            {!hand && <Text style={styles.turnName}>{table.name}</Text>}
          </View>

          {Array.from({ length: n }, (_, number) => {
            const seat = table.seats.find((s) => s.number === number);
            const at = place(number);
            const inHand = playing ? hand.players.find((p) => p.seat === number) : undefined;
            const turn = playing && hand.to_act === number && !hand.waiting_for_cards;
            const box = { left: at.x - SEAT_W / 2, top: at.y - SEAT_H / 2 };
            const bet = inHand && inHand.street_bet > 0 ? inHand.street_bet : 0;
            const betAt = place(number, 0.55);
            return (
              <View key={number} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {bet > 0 && (
                  <View style={[styles.bet, { left: betAt.x - 30, top: betAt.y - 11 }]}>
                    <Text style={styles.betText}>{bet.toLocaleString()}</Text>
                  </View>
                )}
                {hand?.button === number && seat && (
                  <View
                    style={[
                      styles.button,
                      { left: place(number, 0.72).x - 11, top: place(number, 0.72).y - 11 },
                    ]}
                  >
                    <Text style={styles.buttonText}>D</Text>
                  </View>
                )}
                {seat ? (
                  <View
                    style={[
                      styles.seat,
                      box,
                      number === table.my_seat && styles.mine,
                      turn && styles.turn,
                      inHand?.folded && styles.folded,
                    ]}
                  >
                    <Text style={styles.name} numberOfLines={1}>
                      {number === table.my_seat ? "You" : seat.display_name}
                    </Text>
                    <Text style={styles.stack}>{seat.stack.toLocaleString()}</Text>
                    <Text style={styles.note} numberOfLines={1}>
                      {seatNote(table, number, inHand)}
                    </Text>
                  </View>
                ) : (
                  <Tappable
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
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

/** Under a player's stack: small or big blind, folded, all-in, or sitting out. */
function seatNote(
  table: PokerTable,
  number: number,
  inHand: { folded: boolean; all_in: boolean } | undefined,
): string {
  const hand = table.hand;
  if (!hand || hand.street === "done") return "";
  if (!inHand) return "next hand";
  if (inHand.folded) return "folded";
  if (inHand.all_in) return "ALL-IN";
  if (hand.small_blind_seat === number) return "small blind";
  if (hand.big_blind_seat === number) return "big blind";
  return "";
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
        <Text style={[styles.seconds, { color: left <= 5000 ? POKER.fold[0] : ON_FELT }]}>
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
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: SEAT_W,
    },
    street: { fontSize: 13, fontFamily: t.fonts.bold, color: "rgba(255,255,255,0.75)" },
    dealing: { fontSize: 20, fontFamily: t.fonts.bold, color: ON_FELT },
    pot: { fontSize: 20, fontFamily: t.fonts.bold, color: POKER.gold[0] },
    turnName: {
      fontSize: 15,
      fontFamily: t.fonts.bold,
      color: ON_FELT,
      textAlign: "center",
    },
    ringMiddle: { alignItems: "center", justifyContent: "center" },
    seconds: { fontSize: 32, fontFamily: t.fonts.bold },
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
    mine: { borderColor: t.colors.primary },
    turn: {
      borderColor: POKER.gold[0],
      borderWidth: 3,
      boxShadow: `0 0 16px ${POKER.gold[0]}`,
    },
    folded: { opacity: 0.45 },
    empty: { borderStyle: "dashed", backgroundColor: "transparent" },
    picked: { borderStyle: "solid", borderColor: POKER.gold[0], backgroundColor: POKER.gold[0] },
    emptyText: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    pickedText: { color: POKER.gold[1] },
    name: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    stack: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.text },
    note: { fontSize: 10, fontFamily: t.fonts.regular, color: t.colors.muted },
    bet: {
      position: "absolute",
      width: 60,
      alignItems: "center",
      paddingVertical: 2,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    betText: { fontSize: 12, fontFamily: t.fonts.bold, color: POKER.gold[0] },
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
    },
    buttonText: { fontSize: 12, fontFamily: t.fonts.bold, color: "#111111" },
  });
