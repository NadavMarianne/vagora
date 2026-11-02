import { router } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";

import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
import { explainAuthError } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState("");

  async function logIn() {
    setError("");
    setResetSent("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // The app moves on by itself once Firebase confirms the login.
    } catch (e) {
      setError(explainAuthError(e));
    }
  }

  async function forgotPassword() {
    setError("");
    setResetSent("");
    const address = email.trim();
    if (!address) {
      setError("Type your email above, then tap “Forgot password?” again.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, address);
      // Firebase doesn't say whether the account exists, so nobody can test emails here.
      setResetSent(
        `If there’s an account for ${address}, a link to set a new password is on its way. ` +
          "Check your spam folder too. You can choose your old password again.",
      );
    } catch (e) {
      setError(explainAuthError(e));
    }
  }

  return (
    <Screen>
      <Title>Welcome to vagora</Title>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Log in" onPress={logIn} />
      <Button title="Forgot password?" kind="secondary" onPress={forgotPassword} />
      {resetSent !== "" && <Body>{resetSent}</Body>}
      <Body>New here?</Body>
      <Button title="Create an account" kind="secondary" onPress={() => router.push("/sign-up")} />
    </Screen>
  );
}
