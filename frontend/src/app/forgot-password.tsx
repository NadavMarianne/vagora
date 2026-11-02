import { router, useLocalSearchParams } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";

import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
import { explainAuthError } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";

export default function ForgotPassword() {
  // The login screen passes on whatever email was already typed there.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  async function send() {
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSentTo(email.trim());
    } catch (e) {
      setError(explainAuthError(e));
    }
  }

  if (sentTo) {
    return (
      <Screen>
        <Title>Check your email</Title>
        {/* Firebase doesn't say whether the account exists, so nobody can test emails here. */}
        <Body>
          If there’s an account for {sentTo}, a link to set a new password is on its way. Check your
          spam folder too.
        </Body>
        <Body>You can choose your old password again.</Body>
        <Button title="Back to log in" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body>Enter your email, and we’ll send you a link to set a new password.</Body>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Send the link" onPress={send} />
    </Screen>
  );
}
