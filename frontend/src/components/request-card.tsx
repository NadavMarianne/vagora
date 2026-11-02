// A change to a product waiting for its owners' approval, with Approve / Decline for the people
// it waits for, and Cancel for whoever asked.
import { StyleSheet, Text, View } from "react-native";

import { Body, Button, colors } from "@/components/ui";
import type { ProductRequest } from "@/lib/types";

const names = (people: { display_name: string }[]) => people.map((p) => p.display_name).join(", ");

/** What a request asks for, in words. `forMe` when you're the one asked to co-own. */
export function describeRequest(request: ProductRequest, forMe = false): string {
  const by = request.mine ? "You" : request.requested_by.display_name;
  switch (request.kind) {
    case "edit": {
      const parts = [];
      if (request.new_name !== null) parts.push(`rename it to “${request.new_name}”`);
      if (request.new_description !== null) parts.push("change its description");
      return `${by} want${request.mine ? "" : "s"} to ${parts.join(" and ")}`;
    }
    case "close":
      return `${by} want${request.mine ? "" : "s"} to close it`;
    case "add_owner":
      return forMe
        ? `${by} asks you to co-own it`
        : `${by} want${request.mine ? "" : "s"} ${request.member?.display_name} to co-own it`;
    case "remove_owner":
      return `${by} want${request.mine ? "" : "s"} to remove ${request.member?.display_name} as an owner`;
  }
}

export function RequestCard({
  request,
  forMe,
  onAnswer,
  onCancel,
}: {
  request: ProductRequest;
  forMe: boolean;
  onAnswer: (approve: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{describeRequest(request, forMe)}</Text>
      {request.kind === "edit" && request.new_description !== null && (
        <Body>“{request.new_description}”</Body>
      )}
      <Text style={styles.small}>
        Approved: {names(request.approved)}. Waiting for: {names(request.waiting_for)}.
      </Text>
      <Text style={styles.small}>Expires {new Date(request.expires_at).toLocaleString()}</Text>
      {request.mine_to_answer && (
        <View style={styles.answers}>
          <View style={styles.answer}>
            <Button title="Approve" onPress={() => onAnswer(true)} />
          </View>
          <View style={styles.answer}>
            <Button title="Decline" kind="secondary" onPress={() => onAnswer(false)} />
          </View>
        </View>
      )}
      {request.mine && <Button title="Take it back" kind="secondary" onPress={onCancel} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, padding: 12, gap: 6 },
  title: { fontSize: 16, fontWeight: "600", color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  answers: { flexDirection: "row", gap: 12 },
  answer: { flex: 1 },
});
