import { signOut } from "firebase/auth";
import { useState } from "react";

import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { type Profile, useSession } from "@/lib/session";

export default function ProfileSetup() {
  const { setProfile } = useSession();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      const profile = await api<Profile>("/me", {
        method: "POST",
        body: { username, display_name: displayName },
      });
      setProfile(profile);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <Screen>
      <Title>Set up your profile</Title>
      <Field
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. nadav_m"
      />
      <Body>
        Unique, used to find and invite you. 3 to 20 letters, numbers, or _. It can’t be changed
        later yet.
      </Body>
      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="e.g. Nadav"
      />
      <Body>What others see. Anything you like, up to 30 characters.</Body>
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      <Button title="Log out" kind="secondary" onPress={() => signOut(auth)} />
    </Screen>
  );
}
