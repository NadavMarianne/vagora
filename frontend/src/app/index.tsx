import { type Href, router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { orderState } from "@/components/order-row";
import { Tappable } from "@/components/tappable";
import {
  Body,
  Button,
  ErrorText,
  Heading,
  levelColors,
  Loading,
  Screen,
  Small,
  TimedButton,
  TimeLeft,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import { useSession } from "@/lib/session";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { LeftMarket, Market, Order, ReceivedInvite } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { useLoad, useReloadAt } from "@/lib/use-load";

/** An order you sell that waits for you, with its market (backend/app/orders.py). */
type ToDeliver = Order & { market_id: number; market_name: string; currency_name: string };

type HomePage = { markets: Market[]; toDeliver: ToDeliver[] };

/** "Good morning", "Good evening"... by the phone's clock. */
function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const { session } = useSession();
  const { list: notifications, markRead } = useNotifications();
  const {
    data,
    error,
    reload: reloadHome,
  } = useLoad(
    useCallback(async (): Promise<HomePage> => {
      // Your markets first: loading them catches every market up (missed deadlines and more).
      const markets = await api<Market[]>("/markets");
      const toDeliver = await api<ToDeliver[]>("/orders/to-deliver");
      return { markets, toDeliver };
    }, []),
  );
  const { data: invites, reload: reloadInvites } = useLoad(
    useCallback(() => api<ReceivedInvite[]>("/invites"), []),
  );
  const { data: left, reload: reloadLeft } = useLoad(
    useCallback(() => api<LeftMarket[]>("/markets/left"), []),
  );
  const [inviteError, setInviteError] = useState("");
  const [rejoinError, setRejoinError] = useState("");
  // Reordering your markets: the order being arranged, saved when you tap Done.
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<Market[]>([]);
  const ordering = useAction(reloadHome);
  const [now] = useState(() => new Date());
  // When a deadline of something you deliver runs out, show it at once.
  useReloadAt(
    (data?.toDeliver ?? []).map((o) => (o.status === "open" ? o.due_at : o.contest_until)),
    reloadHome,
  );
  if (session.state !== "ready") return null;
  const { profile } = session;

  async function answer(invite: ReceivedInvite, accept: boolean) {
    setInviteError("");
    try {
      await api(`/invites/${invite.id}/${accept ? "accept" : "decline"}`, { method: "POST" });
      await Promise.all([reloadInvites(), reloadHome()]);
      if (accept) router.push(`/markets/${invite.market_id}`);
    } catch (e) {
      setInviteError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      await reloadInvites();
    }
  }

  function startReorder() {
    setOrder(data?.markets ?? []);
    setReordering(true);
  }

  function move(index: number, by: number) {
    const next = [...order];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setOrder(next);
  }

  function saveOrder() {
    return ordering.run(async () => {
      await api("/markets/order", { method: "PUT", body: { market_ids: order.map((m) => m.id) } });
      setReordering(false);
    });
  }

  async function rejoin(market: LeftMarket) {
    setRejoinError("");
    try {
      await api(`/markets/${market.id}/rejoin`, { method: "POST" });
      await Promise.all([reloadLeft(), reloadHome()]);
      router.push(`/markets/${market.id}`);
    } catch (e) {
      setRejoinError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      await reloadLeft();
    }
  }

  const toDeliver = data?.toDeliver ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const waiting = toDeliver.length + (invites?.length ?? 0);
  const recent = notifications.slice(0, 3);

  return (
    <Screen>
      <View style={styles.hello}>
        <Text style={styles.date}>
          {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </Text>
        <Text style={styles.greeting}>
          {greeting(now)}, {profile.display_name}
        </Text>
        <Text style={styles.summary}>
          {waiting === 0 && unread === 0
            ? "Nothing waiting for you. Enjoy your day."
            : [
                toDeliver.length > 0 &&
                  `${toDeliver.length} ${toDeliver.length === 1 ? "order" : "orders"} to deliver`,
                invites &&
                  invites.length > 0 &&
                  `${invites.length} ${invites.length === 1 ? "invite" : "invites"}`,
                unread > 0 && `${unread} unread`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </Text>
      </View>

      {invites && invites.length > 0 && (
        <>
          <Heading>Invites for you</Heading>
          {invites.map((invite) => (
            <View key={invite.id} style={styles.card}>
              <Body>
                <Text style={styles.bold}>{invite.invited_by_display_name}</Text> invited you to{" "}
                <Text style={styles.bold}>{invite.market_name}</Text>
              </Body>
              <View style={styles.answers}>
                <View style={styles.answer}>
                  <TimedButton
                    title="Accept"
                    kind="good"
                    from={invite.created_at}
                    until={invite.expires_at}
                    onPress={() => answer(invite, true)}
                  />
                </View>
                <View style={styles.answer}>
                  <Button title="Decline" kind="bad" fill onPress={() => answer(invite, false)} />
                </View>
              </View>
            </View>
          ))}
          <ErrorText>{inviteError}</ErrorText>
        </>
      )}

      {toDeliver.length > 0 && (
        <>
          <Heading>To deliver</Heading>
          {toDeliver.map((order) => (
            <Tappable
              key={order.id}
              style={[styles.card, styles.deliver]}
              accessibilityRole="button"
              onPress={() => router.push(`/markets/${order.market_id}/orders/${order.id}`)}
            >
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>{order.product_name}</Text>
                <Text style={styles.muted}>
                  For {order.other_display_name} · {order.market_name}
                </Text>
                <Text
                  style={[
                    styles.state,
                    order.status !== "open" && { color: levelColors(t, "warning")[0] },
                  ]}
                >
                  {orderState(order)}
                </Text>
              </View>
              {order.status === "open" && order.delivery === "deadline" && (
                <TimeLeft until={order.due_at} style={styles.due} />
              )}
            </Tappable>
          ))}
        </>
      )}

      <View style={styles.headingRow}>
        <Heading>Your markets</Heading>
        {(data?.markets.length ?? 0) > 1 && (
          <Tappable
            onPress={reordering ? saveOrder : startReorder}
            accessibilityRole="button"
            style={styles.reorder}
          >
            <Text style={styles.reorderText}>{reordering ? "Done" : "Reorder"}</Text>
          </Tappable>
        )}
      </View>
      <ErrorText>{error}</ErrorText>
      <ErrorText>{ordering.error}</ErrorText>
      {!data && !error && <Loading />}
      {data?.markets.length === 0 && <Body>You’re not in any market yet. Create one!</Body>}
      {reordering && (
        <Small>Move markets up or down, then tap Done. The menu follows this order.</Small>
      )}
      {(reordering ? order : (data?.markets ?? [])).map((market, index, list) => {
        const count = toDeliver.filter((o) => o.market_id === market.id).length;
        const content = (
          <>
            <View style={styles.rowText}>
              <Text style={styles.cardTitle}>{market.name}</Text>
              {count > 0 && (
                <Text style={styles.muted}>
                  {count} {count === 1 ? "order" : "orders"} to deliver
                </Text>
              )}
            </View>
            {reordering ? (
              <View style={styles.arrows}>
                <Tappable
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                  style={[styles.arrow, index === 0 && styles.arrowOff]}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${market.name} up`}
                >
                  <Text style={styles.arrowText}>▲</Text>
                </Tappable>
                <Tappable
                  onPress={() => move(index, 1)}
                  disabled={index === list.length - 1}
                  style={[styles.arrow, index === list.length - 1 && styles.arrowOff]}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${market.name} down`}
                >
                  <Text style={styles.arrowText}>▼</Text>
                </Tappable>
              </View>
            ) : (
              <Text style={styles.balance}>
                {market.my_balance.toLocaleString()}{" "}
                <Text style={styles.currency}>{market.currency_name}</Text>
              </Text>
            )}
          </>
        );
        return reordering ? (
          <View key={market.id} style={[styles.card, styles.market]}>
            {content}
          </View>
        ) : (
          <Tappable
            key={market.id}
            style={[styles.card, styles.market]}
            onPress={() => router.push(`/markets/${market.id}`)}
            accessibilityRole="button"
          >
            {content}
          </Tappable>
        );
      })}
      <Button
        title="Create a market"
        kind="secondary"
        onPress={() => router.push("/markets/new")}
      />

      {recent.length > 0 && (
        <>
          <Heading>Recent activity</Heading>
          {recent.map((n) => (
            <Tappable
              key={n.id}
              style={styles.activity}
              accessibilityRole="button"
              onPress={() => {
                markRead(n.id);
                router.push((n.path || "/notifications") as Href);
              }}
            >
              <View style={[styles.dot, { backgroundColor: levelColors(t, n.level)[0] }]} />
              <View style={styles.rowText}>
                <Text style={[styles.activityText, !n.read && styles.bold]}>{n.message}</Text>
                <Text style={styles.muted}>{new Date(n.created_at).toLocaleString()}</Text>
              </View>
            </Tappable>
          ))}
          <Button title="See all" kind="secondary" onPress={() => router.push("/notifications")} />
        </>
      )}

      {left && left.length > 0 && (
        <>
          <Heading>Markets you left</Heading>
          {left.map((market) => (
            <View key={market.id} style={styles.card}>
              <Text style={styles.cardTitle}>{market.name}</Text>
              <Text style={styles.muted}>
                {market.my_balance.toLocaleString()} {market.currency_name} waiting for you. You can
                rejoin until {new Date(market.rejoin_until).toLocaleString()}.
              </Text>
              <Button title="Rejoin" kind="secondary" onPress={() => rejoin(market)} />
            </View>
          ))}
          <ErrorText>{rejoinError}</ErrorText>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    hello: { gap: 4, paddingVertical: 4 },
    date: {
      fontSize: 13,
      fontFamily: t.fonts.accent,
      color: t.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    greeting: {
      fontSize: 30,
      fontFamily: t.fonts.heading,
      color: t.colors.text,
      textTransform: t.upperTitles ? "uppercase" : "none",
    },
    summary: { fontSize: 15, fontFamily: t.fonts.regular, color: t.colors.muted },
    card: {
      backgroundColor: t.colors.surface,
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius.card,
      padding: 16,
      gap: 10,
      boxShadow: t.shadow.card || undefined,
    },
    deliver: { flexDirection: "row", alignItems: "center", gap: 12 },
    market: { flexDirection: "row", alignItems: "center", gap: 12 },
    headingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    reorder: { paddingVertical: 4, paddingHorizontal: 8 },
    reorderText: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.primary },
    arrows: { flexDirection: "row", gap: 8 },
    arrow: {
      width: 44,
      height: 44,
      borderRadius: t.radius.button,
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    arrowOff: { opacity: 0.35 },
    arrowText: { fontSize: 16, color: t.colors.text },
    rowText: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 17, fontFamily: t.fonts.bold, color: t.colors.text },
    state: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.primary },
    due: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    balance: { fontSize: 22, fontFamily: t.fonts.heading, color: t.colors.text },
    currency: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    activity: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
    activityText: { fontSize: 15, fontFamily: t.fonts.regular, color: t.colors.text },
    bold: { fontFamily: t.fonts.bold },
    muted: { fontFamily: t.fonts.regular, fontSize: 13, color: t.colors.muted },
    answers: { flexDirection: "row", gap: 12 },
    answer: { flex: 1 },
  });
