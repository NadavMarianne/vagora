import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { orderState } from "@/components/order-row";
import { Body, Button, colors, ErrorText, Loading, Screen, Title } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Market, Order } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type OrderPage = { market: Market; order: Order };

type Action = {
  title: string;
  path: string;
  kind?: "primary" | "secondary";
  /** Asks before doing it: [title, message]. */
  confirm?: [string, string];
};

const when = (date: string) => new Date(date).toLocaleString();

/** What you can do with the order now, depending on your side and where it stands. */
function actionsFor(order: Order, currency: string): Action[] {
  const back = Math.round((order.price * order.refund_percent) / 100);
  if (order.role === "buyer") {
    switch (order.status) {
      case "open": {
        const actions: Action[] = [{ title: "It’s done", path: "fulfilled" }];
        if (order.refundable && !order.late) {
          actions.push({
            title: `Cancel (get ${back} ${currency} back)`,
            path: "cancel",
            kind: "secondary",
            confirm: ["Cancel this order?", `${back} ${currency} come back to you.`],
          });
        }
        if (!order.refundable && !order.refund_requested) {
          actions.push({ title: "Ask for a refund", path: "request-refund", kind: "secondary" });
        }
        if (!order.refundable) {
          actions.push({
            title: "Give it up",
            path: "discard",
            kind: "secondary",
            confirm: ["Give up this order?", "You won’t get any coins back."],
          });
        }
        return actions;
      }
      case "done_claimed":
        return [
          { title: "Yes, it’s done", path: "fulfilled" },
          {
            title: "It wasn’t done",
            path: "dispute",
            kind: "secondary",
            confirm: [
              "Dispute this?",
              "The coins stay held until it’s settled. Settling through the court comes in a later update.",
            ],
          },
        ];
      case "disputed":
        return [
          {
            title: "Give up the dispute",
            path: "fulfilled",
            kind: "secondary",
            confirm: ["Give up the dispute?", "The order counts as done and the seller is paid."],
          },
        ];
    }
  } else {
    switch (order.status) {
      case "open": {
        const actions: Action[] = [{ title: "I did it", path: "done" }];
        if (order.refund_requested) {
          actions.push(
            { title: "Refund in full", path: "refund", kind: "secondary" },
            { title: "Decline the refund", path: "decline-refund", kind: "secondary" },
          );
        }
        return actions;
      }
      case "disputed":
        return [
          {
            title: "Give up (refund in full)",
            path: "refund",
            kind: "secondary",
            confirm: ["Give up the dispute?", "The buyer gets the full price back."],
          },
        ];
    }
  }
  return [];
}

export default function OrderScreen() {
  const { id, orderId } = useLocalSearchParams<{ id: string; orderId: string }>();
  const path = `/markets/${id}/orders/${orderId}`;
  const [error, setError] = useState("");
  const {
    data,
    error: loadError,
    reload,
  } = useLoad(
    useCallback(async (): Promise<OrderPage> => {
      const [market, order] = await Promise.all([api<Market>(`/markets/${id}`), api<Order>(path)]);
      return { market, order };
    }, [id, path]),
  );

  async function run(action: Action) {
    setError("");
    try {
      await api(`${path}/${action.path}`, { method: "POST" });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  function press(action: Action) {
    if (!action.confirm) return run(action);
    const [title, message] = action.confirm;
    Alert.alert(title, message, [
      { text: "Back", style: "cancel" },
      { text: "Yes", onPress: () => run(action) },
    ]);
  }

  if (!data) {
    return (
      <Screen>
        <ErrorText>{loadError}</ErrorText>
        {!loadError && <Loading />}
      </Screen>
    );
  }
  const { market, order } = data;
  const currency = market.currency_name;
  const buyer = order.role === "buyer";

  return (
    <Screen>
      <Stack.Screen options={{ title: order.product_name }} />
      <Title>{orderState(order)}</Title>
      <View style={styles.facts}>
        <Fact label={buyer ? "Seller" : "Buyer"} value={order.other_display_name} />
        <Fact label="Price" value={`${order.price.toLocaleString()} ${currency}`} />
        <Fact label="Bought" value={when(order.created_at)} />
        <Fact
          label={order.delivery === "deadline" ? "Deadline" : "Can be asked for until"}
          value={when(order.due_at)}
        />
        <Fact
          label="Refunds"
          value={order.refundable ? `${order.refund_percent}% back if cancelled` : "Not refundable"}
        />
        <Fact
          label="When done, the coins"
          value={order.coin_mode === "to_seller" ? "go to the seller" : "vanish"}
        />
        {order.auto_complete_at && (
          <Fact label="Counts as done on" value={when(order.auto_complete_at)} />
        )}
        {order.ended_at && <Fact label="Ended" value={when(order.ended_at)} />}
      </View>

      {order.status === "open" && order.delivery === "on_request" && buyer && (
        <Body>Ask the seller in person. When it’s done, tap “It’s done”.</Body>
      )}
      {order.status === "done_claimed" && buyer && (
        <Body>If you don’t answer, it counts as done on {when(order.auto_complete_at!)}.</Body>
      )}
      {order.late && <Body>The deadline has passed.</Body>}

      {actionsFor(order, currency).map((action) => (
        <Button
          key={action.path}
          title={action.title}
          kind={action.kind}
          onPress={() => press(action)}
        />
      ))}
      <ErrorText>{error}</ErrorText>
      <Button
        title="See the product"
        kind="secondary"
        onPress={() => router.push(`/markets/${id}/store/${order.product_id}`)}
      />
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { gap: 8 },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { fontSize: 15, color: colors.muted },
  value: { fontSize: 15, color: colors.text, fontWeight: "600", flexShrink: 1, textAlign: "right" },
});
