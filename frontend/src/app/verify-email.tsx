import { sendEmailVerification, signOut } from "firebase/auth";
import { useState } from "react";

import { Body, Button, ErrorText, Screen, Title } from "@/components/ui";
import { explainAuthError } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";
import { useSession } from "@/lib/session";

export default function VerifyEmail() {
  const { refresh } = useSession();
  const [message, setMessage] = useState("");
  const email = auth.currentUser?.email;

  async function checkAgain() {
    setMessage("");
    await refresh();
    // If still not verified, this screen stays, so say why.
    if (!auth.currentUser?.emailVerified) {
      setMessage("Not verified yet. Open the link in the email first.");
    }
  }

  async function resend() {
    setMessage("");
    try {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      setMessage("Sent. Check your inbox (and spam folder).");
    } catch (e) {
      setMessage(explainAuthError(e));
    }
  }

  return (
    <Screen>
      <Title>Check your email</Title>
      <Body>
        We sent a link to {email}. Open it to confirm your email, then come back here.
      </Body>
      <Button title="I've verified my email" onPress={checkAgain} />
      <Button title="Send the email again" kind="secondary" onPress={resend} />
      <ErrorText>{message}</ErrorText>
      <Button title="Log out" kind="secondary" onPress={() => signOut(auth)} />
    </Screen>
  );
}
