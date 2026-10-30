import { Stack } from "expo-router";

import { Body, Button, Loading, Screen, Title } from "@/components/ui";
import { warmUp } from "@/lib/api";
import { SessionProvider, useSession } from "@/lib/session";

// Wake the backend and database right away, while Firebase checks who is logged in.
warmUp();

export default function RootLayout() {
  return (
    <SessionProvider>
      <Screens />
    </SessionProvider>
  );
}

/** Shows only the screens that fit where the person is: login, verify email, profile, or the app. */
function Screens() {
  const { session, refresh } = useSession();

  if (session.state === "loading") return <Loading />;
  if (session.state === "error") {
    return (
      <Screen>
        <Title>Something went wrong</Title>
        <Body>{session.message}</Body>
        <Button title="Try again" onPress={refresh} />
      </Screen>
    );
  }

  const is = (state: typeof session.state) => session.state === state;
  return (
    <Stack>
      <Stack.Protected guard={is("signed-out")}>
        <Stack.Screen name="sign-in" options={{ title: "Log in" }} />
        <Stack.Screen name="sign-up" options={{ title: "Sign up" }} />
      </Stack.Protected>
      <Stack.Protected guard={is("unverified")}>
        <Stack.Screen name="verify-email" options={{ title: "Verify your email" }} />
      </Stack.Protected>
      <Stack.Protected guard={is("no-profile")}>
        <Stack.Screen name="profile-setup" options={{ title: "Your profile" }} />
      </Stack.Protected>
      <Stack.Protected guard={is("ready")}>
        <Stack.Screen name="index" options={{ title: "vagora" }} />
        <Stack.Screen name="markets/new" options={{ title: "Create a market" }} />
        <Stack.Screen name="markets/[id]/index" options={{ title: "Market" }} />
        <Stack.Screen name="markets/[id]/settings" options={{ title: "Market settings" }} />
      </Stack.Protected>
    </Stack>
  );
}
