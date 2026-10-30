import { signOut } from "firebase/auth";

import { Body, Button, Screen, Title } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { useSession } from "@/lib/session";

export default function Home() {
  const { session } = useSession();
  if (session.state !== "ready") return null;
  const { profile } = session;

  return (
    <Screen>
      <Title>Hi, {profile.display_name}!</Title>
      <Body>You’re logged in as @{profile.username}.</Body>
      <Body>Your markets will appear here next.</Body>
      <Button title="Log out" kind="secondary" onPress={() => signOut(auth)} />
    </Screen>
  );
}
