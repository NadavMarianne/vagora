import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Foldable } from "@/components/controls";
import { DurationPicker, formatDuration } from "@/components/duration-picker";
import { orderState } from "@/components/order-row";
import {
  Body,
  Button,
  colors,
  ErrorText,
  Loading,
  Screen,
  TimedButton,
  Title,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Market, Order } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type OrderPage = { market: Market; order: Order };

type Action = {
  title: string;
  path: string;
  kind?: "primary" | "secondary" | "good" | "bad";
  /** Asks before doing it: [title, message]. */
  confirm?: [string, string];
  /** A deadline for this button: its time bar drains from `from` to `until`. */
  timer?: { from: string; until: string };
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
    kind: "bad",
    confirm: [
      "End this order?",
      "The buyer gets the full price back. It counts as refusing, and they can report it.",
    ],
  };
  if (order.role === "buyer") {
    switch (order.status) {
      case "open": {
        const actions: Action[] = [{ title: "It’s done", path: "fulfilled", kind: "good" }];
        if (order.delivery === "on_request") {
          actions.push({
            title: "They refused",
            path: "refused",
            kind: "bad",
            confirm: [
              "Did the seller refuse?",
              "This counts as a missed deadline. Then you choose: cancel, propose a new deadline, or just wait.",
            ],
          });
        }
        if (order.refundable) {
          actions.push({
            title: `Cancel (get ${back} ${currency} back)`,
            path: "cancel",
            kind: "secondary",
            confirm: ["Cancel this order?", `${back} ${currency} come back to you.`],
            timer: { from: order.created_at, until: order.due_at },
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
          { title: "Yes, it’s done", path: "fulfilled", kind: "good" },
          {
            title: "It wasn’t done",
            path: "dispute",
            kind: "bad",
            confirm: ["Dispute this?", "The coins stay held until it’s settled in court."],
            timer: { from: order.done_claimed_at!, until: order.auto_complete_at! },
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
      case "new_deadline_asked":
        return [{ title: "It’s done after all", path: "fulfilled", kind: "good" }, missedCancel];
      case "cancel_pending":
        return [{ title: "It was done after all", path: "fulfilled", kind: "secondary" }];
    }
  } else {
    switch (order.status) {
      case "open": {
        const actions: Action[] = [
          {
            title: "I did it",
            path: "done",
            kind: "good",
            timer:
              order.delivery === "deadline"
                ? { from: order.created_at, until: order.due_at }
                : undefined,
          },
        ];
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
        return [{ title: "I did it", path: "done", kind: "good" }, endIt];
      case "new_deadline_asked":
        return [
          {
            title: "Agree to the new deadline",
            path: "agree-deadline",
            kind: "good",
            timer: { from: order.new_deadline_asked_at!, until: order.new_deadline_answer_by! },
          },
          { title: "Decline it", path: "decline-deadline", kind: "secondary" },
          { title: "I did it", path: "done", kind: "secondary" },
          endIt,
        ];
      case "cancel_pending":
        return [
          {
            title: "It wasn’t done (admit)",
            path: "refund",
            kind: "good",
            timer: { from: order.contest_from!, until: order.contest_until! },
          },
          {
            title: "It was actually done (contest)",
            path: "done",
            kind: "bad",
            confirm: ["Contest the cancellation?", "It becomes a dispute, settled in court."],
          },
        ];
    }
  }
  return [];
}

/** The order's story so far, oldest first. */
function history(order: Order): string[] {
  const buyer = order.role === "buyer";
  const other = order.other_display_name;
  const lines = [`${when(order.created_at)}: ${buyer ? "You bought it" : `${other} bought it`}.`];
  if (order.missed_at) {
    lines.push(
      `${when(order.missed_at)}: the deadline was missed` +
        (order.missed_count > 1 ? ` (${order.missed_count} times so far).` : "."),
    );
  }
  if (order.new_deadline_asked_at) {
    lines.push(`${when(order.new_deadline_asked_at)}: a new deadline was proposed.`);
  }
  if (order.done_claimed_at) {
    lines.push(
      `${when(order.done_claimed_at)}: ${buyer ? `${other} said` : "you said"} it was done.`,
    );
  }
  if (order.contest_from) {
    lines.push(`${when(order.contest_from)}: ${buyer ? "you" : other} cancelled it.`);
  }
  if (order.ended_at) lines.push(`${when(order.ended_at)}: ${orderState(order).toLowerCase()}.`);
  return lines;
}

/** What happens next, in words, from your side. */
function next(order: Order, currency: string): string {
  const buyer = order.role === "buyer";
  switch (order.status) {
    case "open":
      if (order.delivery === "on_request") {
        return buyer
          ? `Ask the seller in person, any time until ${when(order.due_at)}. When it’s done, tap “It’s done”. If they refuse, tap “They refused”.`
          : `The buyer can ask you for it any time until ${when(order.due_at)}. When it’s done, tap “I did it”.`;
      }
      return buyer
        ? `The seller should do it by ${when(order.due_at)}. When it’s done, tap “It’s done”.`
        : `Do it by ${when(order.due_at)}, then tap “I did it”. If the time runs out, the deadline is missed.`;
    case "done_claimed":
      return buyer
        ? `The seller says it’s done. If you don’t answer, it counts as done on ${when(order.auto_complete_at!)} and they’re paid.`
        : `Waiting for the buyer. If they don’t answer, it counts as done on ${when(order.auto_complete_at!)}.`;
    case "disputed":
      return `You disagree about whether it was done, so the ${order.price} ${currency} stay held until it’s settled in court. Either side can give up.`;
    case "missed":
      return buyer
        ? "Doing nothing means you’re still waiting for it, for as long as you like. You can also cancel for the full price back, or propose a new deadline. You can report it either way; accepting it late makes it softer."
        : "The buyer chooses what happens next. Meanwhile you can still do it, or end the order (a full refund, counted as refusing).";
    case "new_deadline_asked":
      return buyer
        ? `You proposed a new deadline: ${formatDuration(order.new_deadline_seconds!)} from when the seller agrees. They can answer until ${when(order.new_deadline_answer_by!)}. If they don’t, you’re back to choosing.`
        : `The buyer proposes a new deadline: ${formatDuration(order.new_deadline_seconds!)} from when you agree. Answer by ${when(order.new_deadline_answer_by!)}.`;
    case "cancel_pending":
      return buyer
        ? `You get the full price back on ${when(order.contest_until!)}, unless the seller says it was done. Then it goes to court.`
        : `The buyer cancelled. If it really wasn’t done, admit it and they get the full price back now. If it was done, contest it before ${when(order.contest_until!)}, and it goes to court. If you do nothing, they get the full price back then.`;
    default:
      return "This order is over.";
  }
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

  async function run(actionPath: string, body?: unknown) {
    setError("");
    try {
      await api(`${path}/${actionPath}`, { method: "POST", body });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  function press(action: Action) {
    if (!action.confirm) return run(action.path);
    const [title, message] = action.confirm;
    Alert.alert(title, message, [
      { text: "Back", style: "cancel" },
      { text: "Yes", onPress: () => run(action.path) },
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
      </View>

      <Text style={styles.heading}>What happened</Text>
      {history(order).map((line) => (
        <Text key={line} style={styles.history}>
          {line}
        </Text>
      ))}

      <Text style={styles.heading}>What happens next</Text>
      <Body>{next(order, currency)}</Body>

      {actionsFor(order, currency, market.contest_window_seconds).map((action) =>
        action.timer ? (
          <TimedButton
            key={action.path}
            title={action.title}
            kind={action.kind}
            from={action.timer.from}
            until={action.timer.until}
            onPress={() => press(action)}
          />
        ) : (
          <Button
            key={action.path}
            title={action.title}
            kind={action.kind}
            onPress={() => press(action)}
          />
        ),
      )}
      {buyer && order.status === "missed" && (
        <NewDeadlineForm
          onSend={(deadline, answerTime) =>
            run("new-deadline", { deadline_seconds: deadline, expires_in_seconds: answerTime })
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
  heading: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  history: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
