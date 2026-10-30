import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { useState } from "react";

import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
import { explainAuthError } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");

  async function signUp() {
    setError("");
    if (password !== repeat) {
      setError("The two passwords don't match.");
      return;
    }
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(user);
      // The app moves on to "verify your email" by itself.
    } catch (e) {
      setError(explainAuthError(e));
    }
  }

  return (
    <Screen>
      <Title>Create your account</Title>
      <Body>
        Passwords need at least 8 characters, with a number, a capital letter, and a special
        character.
      </Body>
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
        autoComplete="new-password"
      />
      <Field
        label="Repeat password"
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoComplete="new-password"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Sign up" onPress={signUp} />
    </Screen>
  );
}
