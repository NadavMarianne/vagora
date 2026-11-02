import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Foldable } from "@/components/controls";
import { DurationPicker, formatDuration } from "@/components/duration-picker";
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

const DAY = 86400;
const when = (date: string) => new Date(date).toLocaleString();

/** What you can do with the order now, depending on your side and where it stands.
 * `contestWindow` is how long a seller has to contest a cancellation after a missed deadline. */
function actionsFor(order: Order, currency: string, contestWindow: number): Action[] {
  const back = Math.round((order.price * order.refund_percent) / 100);
  const missedCancel: Action = {
    title: `Cancel (get all ${order.price} ${currency} back)`,
    path: "cancel",
    kind: "secondary",
    confirm: [
      "Cancel this order?",
      `The seller has ${formatDuration(contestWindow)} to say it was done. If they don’t, you get the full price back. If they do, it goes to court.`,
    ],
  };
  const endIt: Action = {
    title: "End the order",
    path: "end",
    kind: "secondary",
    confirm: [
      "End this order?",
      "The buyer gets the full price back. It counts as refusing, and they can report it.",
    ],
  };
  if (order.role === "buyer") {
    switch (order.status) {
      case "open": {
        const actions: Action[] = [{ title: "It’s done", path: "fulfilled" }];
        if (order.delivery === "on_request") {
          actions.push({
            title: "They refused",
            path: "refused",
            kind: "secondary",
            confirm: [
              "Did the seller refuse?",
              "This counts as a missed deadline. Then you choose: cancel, wait, or propose a new deadline.",
            ],
          });
        }
        if (order.refundable) {
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
      case "missed":
        return [
          { title: "It’s done after all", path: "fulfilled" },
          { title: "Wait for it anyway", path: "accept-late", kind: "secondary" },
          missedCancel,
        ];
      case "late_accepted":
      case "new_deadline_asked":
        return [{ title: "It’s done", path: "fulfilled" }, missedCancel];
      case "cancel_pending":
        return [{ title: "It was done after all", path: "fulfilled", kind: "secondary" }];
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
      case "missed":
      case "late_accepted":
        return [{ title: "I did it", path: "done" }, endIt];
      case "new_deadline_asked":
        return [
          { title: "Agree to the new deadline", path: "agree-deadline" },
          { title: "Decline it", path: "decline-deadline", kind: "secondary" },
          { title: "I did it", path: "done", kind: "secondary" },
          endIt,
        ];
      case "cancel_pending":
        return [
          {
            title: "It was done (contest)",
            path: "done",
            confirm: ["Contest the cancellation?", "It becomes a dispute, settled in court."],
          },
          { title: "OK, refund in full", path: "refund", kind: "secondary" },
        ];
    }
  }
  return [];
}

/** After a missed deadline, the buyer proposes a new one. The timer starts when the seller agrees. */
function NewDeadlineForm({ onSend }: { onSend: (deadline: number, answerTime: number) => void }) {
  const [deadline, setDeadline] = useState(DAY);
  const [answerTime, setAnswerTime] = useState(3 * DAY);
  return (
    <Foldable title="Propose a new deadline">
      <DurationPicker
        label="Done within"
        seconds={deadline}
        onChange={setDeadline}
        min={10}
        max={365 * DAY}
      />
      <Body>Counted from when the seller agrees.</Body>
      <DurationPicker
        label="They have this long to answer"
        seconds={answerTime}
        onChange={setAnswerTime}
        min={10}
        max={30 * DAY}
      />
      <Button title="Propose it" onPress={() => onSend(deadline, answerTime)} />
    </Foldable>
  );
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

  async function run(action: Action, body?: unknown) {
    setError("");
    try {
      await api(`${path}/${action.path}`, { method: "POST", body });
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
        {order.missed_count > 0 && (
          <Fact label="Deadlines missed" value={String(order.missed_count)} />
        )}
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
      {order.status === "missed" && buyer && (
        <Body>
          The deadline was missed. Choose what happens next, with no time limit: cancel for a full
          refund, wait for it anyway, or propose a new deadline. You can also report it later.
        </Body>
      )}
      {order.status === "missed" && !buyer && (
        <Body>
          The deadline was missed. The buyer chooses what happens next. You can still do it, or end
          the order (a full refund, counted as refusing).
        </Body>
      )}
      {order.status === "late_accepted" && (
        <Body>
          The deadline was missed, and {buyer ? "you’re" : "the buyer is"} waiting for it anyway.
        </Body>
      )}
      {order.status === "new_deadline_asked" && (
        <Body>
          {buyer ? "You proposed" : "The buyer proposes"} a new deadline:{" "}
          {formatDuration(order.new_deadline_seconds!)} from when{" "}
          {buyer ? "the seller agrees" : "you agree"}.{buyer ? " They" : " You"} can answer until{" "}
          {when(order.new_deadline_answer_by!)}.
        </Body>
      )}
      {order.status === "cancel_pending" && (
        <Body>
          {buyer
            ? `You cancelled after the missed deadline. You get the full price back on ${when(order.contest_until!)}, unless the seller says it was done.`
            : `The buyer cancelled after the missed deadline. If it was done, contest it before ${when(order.contest_until!)}. Otherwise they get the full price back.`}
        </Body>
      )}

      {actionsFor(order, currency, market.contest_window_seconds).map((action) => (
        <Button
          key={action.path}
          title={action.title}
          kind={action.kind}
          onPress={() => press(action)}
        />
      ))}
      {buyer && (order.status === "missed" || order.status === "late_accepted") && (
        <NewDeadlineForm
          onSend={(deadline, answerTime) =>
            run(
              { title: "", path: "new-deadline" },
              { deadline_seconds: deadline, expires_in_seconds: answerTime },
            )
          }
        />
      )}
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
