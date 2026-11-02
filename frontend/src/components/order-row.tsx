// One order in a list: what it is, with whom, and where it stands.
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { colors } from "@/components/ui";
import type { Order } from "@/lib/types";

/** Where an order stands, in words, from your side. */
export function orderState(order: Order): string {
  switch (order.status) {
    case "open":
      if (order.late) return "Deadline passed";
      if (order.refund_requested) return "Refund asked for";
      return order.delivery === "deadline"
        ? `Due ${new Date(order.due_at).toLocaleString()}`
        : `Can be asked for until ${new Date(order.due_at).toLocaleString()}`;
    case "done_claimed":
      return order.role === "buyer" ? "The seller says it’s done" : "Waiting for the buyer";
    case "disputed":
      return "Disputed";
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    case "discarded":
      return "Given up";
    case "expired":
      return "Expired unused";
  }
}

export function OrderRow({
  order,
  marketId,
  currency,
}: {
  order: Order;
  marketId: string;
  currency: string;
}) {
  const late = order.late || order.status === "disputed";
  return (
    <Tappable
      style={styles.row}
      accessibilityRole="button"
      onPress={() => router.push(`/markets/${marketId}/orders/${order.id}`)}
    >
      <View style={styles.text}>
        <Text style={styles.name}>{order.product_name}</Text>
        <Text style={styles.small}>
          {order.role === "buyer" ? "From" : "For"} {order.other_display_name} ·{" "}
          <Text style={late && styles.warning}>{orderState(order)}</Text>
        </Text>
      </View>
      <Text style={styles.price}>
        {order.price.toLocaleString()} {currency}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  text: { flexShrink: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  warning: { color: colors.error, fontWeight: "600" },
  price: { fontSize: 16, fontWeight: "600", color: colors.text },
});
