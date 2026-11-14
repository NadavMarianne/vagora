import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { MenuButton } from "@/components/app-menu";
import { LiveBanner } from "@/components/live-banner";
import { NotificationBell } from "@/components/notification-bell";
import { Body, Button, Loading, Screen, Title } from "@/components/ui";
import { warmUp } from "@/lib/api";
import { LiveProvider } from "@/lib/live";
import { NotificationsProvider } from "@/lib/notifications";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { FONTS } from "@/lib/themes";
import { useUpdate } from "@/lib/updates";

// Wake the backend and database right away, while Firebase checks who is logged in.
warmUp();

export default function RootLayout() {
  // Every theme's fonts, loaded once. Until then, nothing is drawn (it takes a moment).
  const [fontsLoaded] = useFonts(FONTS);
  // Meanwhile, and whenever the app comes back to the screen, a new version installs right away.
  const update = useUpdate();
  if (update === "updating") return <Updating />;
  if (!fontsLoaded || update === "checking") return null;
  return (
    <SessionProvider>
      <ThemeProvider>
        <LiveProvider>
          <NotificationsProvider>
            <Themed />
          </NotificationsProvider>
        </LiveProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

/** Shown while a new version installs. Plain, in the icon's colors: themes and fonts may not be
 * loaded yet. */
function Updating() {
  return (
    <View style={updatingStyles.screen}>
      <ActivityIndicator color="#FFD84D" size="large" />
      <Text style={updatingStyles.text}>Updating Vagora…</Text>
    </View>
  );
}

const updatingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#030619",
  },
  text: { color: "#FFFFFF", fontSize: 16 },
});

/** The whole app in the person's theme: the page, the header, and the phone's status bar. */
function Themed() {
  const t = useTheme();
  return (
    // The gesture root lets drags (like reordering markets) run smoothly on the UI thread.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Screens />
      <LiveBanner />
    </GestureHandlerRootView>
  );
}

/** The bell and the ☰ menu, in the top corner of every screen once you're set up. */
function HeaderButtons() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <NotificationBell />
      <MenuButton />
    </View>
  );
}

/** Shows only the screens that fit where the person is: login, verify email, profile, or the app. */
function Screens() {
  const { session, refresh } = useSession();
  const t = useTheme();

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
    <Stack
      screenOptions={{
        headerRight: is("ready") ? () => <HeaderButtons /> : undefined,
        headerStyle: { backgroundColor: t.colors.background },
        headerTintColor: t.colors.text,
        headerTitleStyle: { fontFamily: t.fonts.heading },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.colors.background },
      }}
    >
      <Stack.Protected guard={is("signed-out")}>
        <Stack.Screen name="sign-in" options={{ title: "Log in" }} />
        <Stack.Screen name="sign-up" options={{ title: "Sign up" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Forgot password" }} />
      </Stack.Protected>
      <Stack.Protected guard={is("unverified")}>
        <Stack.Screen name="verify-email" options={{ title: "Verify your email" }} />
      </Stack.Protected>
      <Stack.Protected guard={is("no-profile")}>
        <Stack.Screen name="profile-setup" options={{ title: "Your profile" }} />
      </Stack.Protected>
      <Stack.Protected guard={is("ready")}>
        <Stack.Screen name="index" options={{ title: "vagora" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="markets/[id]/members/index" options={{ title: "Members" }} />
        <Stack.Screen name="markets/new" options={{ title: "Create a market" }} />
        {/* These pages show their own name once it loads; until then the title stays empty. */}
        <Stack.Screen name="markets/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="markets/[id]/settings" options={{ title: "Market settings" }} />
        <Stack.Screen name="markets/[id]/invite" options={{ title: "Invite someone" }} />
        <Stack.Screen name="markets/[id]/store/index" options={{ title: "Store" }} />
        <Stack.Screen name="markets/[id]/store/new" options={{ title: "New product" }} />
        <Stack.Screen name="markets/[id]/store/[productId]/index" options={{ title: "" }} />
        <Stack.Screen
          name="markets/[id]/store/[productId]/my-offer"
          options={{ title: "My offer" }}
        />
        <Stack.Screen
          name="markets/[id]/proposals/[proposalId]"
          options={{ title: "Asked to sell" }}
        />
        <Stack.Screen name="markets/[id]/orders/index" options={{ title: "Orders" }} />
        <Stack.Screen name="markets/[id]/games/index" options={{ title: "Games" }} />
        <Stack.Screen name="markets/[id]/games/new" options={{ title: "Open a table" }} />
        <Stack.Screen name="markets/[id]/games/[tableId]" options={{ title: "" }} />
        <Stack.Screen name="markets/[id]/members/[username]" options={{ title: "" }} />
        <Stack.Screen
          name="markets/[id]/limits-setup"
          options={{ title: "Your limits", headerBackVisible: false }}
        />
        <Stack.Screen name="markets/[id]/orders/[orderId]" options={{ title: "" }} />
      </Stack.Protected>
    </Stack>
  );
}
