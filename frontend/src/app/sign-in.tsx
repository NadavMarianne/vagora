import { Link } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";

import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
import { explainAuthError } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function logIn() {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // The app moves on by itself once Firebase confirms the login.
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
      <Body>
        New here? <Link href="/sign-up">Create an account</Link>
      </Body>
    </Screen>
  );
}
