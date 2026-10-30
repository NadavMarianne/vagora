import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { Chips } from "@/components/controls";
import { Body, Button, ErrorText, Field, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { PendingInvite } from "@/lib/types";

// The backend allows 1 hour to 30 days.
const MAX_HOURS = 30 * 24;

export default function Invite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("7");
  const [unit, setUnit] = useState<"hours" | "days">("days");
  const [error, setError] = useState("");

  async function send() {
    setError("");
    const hours = Number(amount) * (unit === "days" ? 24 : 1);
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) {
      setError("An invite can last from 1 hour to 30 days.");
      return;
    }
    try {
      await api<PendingInvite>(`/markets/${id}/invites`, {
        method: "POST",
        body: { username: username.trim(), expires_in_hours: hours },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <Screen>
      <Field
        label="Their username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. dana_k"
      />
      <Field
        label="The invite expires in"
        value={amount}
        onChangeText={(text) => setAmount(text.replace(/\D/g, ""))}
        keyboardType="number-pad"
      />
      <Chips
        options={[
          { value: "hours", label: "Hours" },
          { value: "days", label: "Days" },
        ]}
        selected={[unit]}
        onChange={([chosen]) => setUnit(chosen)}
      />
      <Body>From 1 hour to 30 days. They can accept or decline until then.</Body>
      <ErrorText>{error}</ErrorText>
      <Button title="Send invite" onPress={send} />
    </Screen>
  );
}
