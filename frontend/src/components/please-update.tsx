// "Please update": shown instead of the whole app once the backend says this version is too old
// (decision 0029). It first looks for an over-the-air update and reloads into it. If there is
// none, the newer version needs a new APK: it links to it when the backend knows where it is.
// "Try again" looks for an update again, and asks the backend again.
// Plain, in the icon's colors, like the "Updating" screen: themes may not be loaded yet.
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { api } from "@/lib/api";
import { updateNow } from "@/lib/updates";

export function PleaseUpdate({ apkUrl }: { apkUrl: string | null }) {
  const [looking, setLooking] = useState(true);

  // When there's an update, the app reloads into it and this screen is gone.
  useEffect(() => {
    updateNow().then(() => setLooking(false));
  }, []);

  // An update if there is one; otherwise ask the backend again, and if the app is new enough
  // now (the minimum was lowered), this screen goes away.
  async function tryAgain() {
    setLooking(true);
    if (!(await updateNow())) await api("/me").catch(() => {});
    setLooking(false);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Please update Vagora</Text>
      <Text style={styles.text}>This version is too old to work anymore.</Text>
      {looking ? (
        <View style={styles.row}>
          <ActivityIndicator color={GOLD} />
          <Text style={styles.text}>Looking for the update…</Text>
        </View>
      ) : (
        <>
          <Text style={styles.text}>
            {apkUrl
              ? "The new version has to be installed. Download it, open the file to install it, then open Vagora again."
              : "The new version has to be installed. Ask whoever gave you Vagora for it."}
          </Text>
          {apkUrl && (
            <Tappable style={[styles.button, styles.main]} onPress={() => Linking.openURL(apkUrl)}>
              <Text style={styles.mainText}>Download the new version</Text>
            </Tappable>
          )}
          <Tappable style={styles.button} onPress={tryAgain}>
            <Text style={styles.buttonText}>Try again</Text>
          </Tappable>
        </>
      )}
    </View>
  );
}

const GOLD = "#FFD84D";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
    backgroundColor: "#030619",
  },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "bold", textAlign: "center" },
  text: { color: "#FFFFFF", fontSize: 16, textAlign: "center", lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF55",
  },
  main: { backgroundColor: GOLD, borderColor: GOLD },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  mainText: { color: "#030619", fontSize: 16, fontWeight: "bold" },
});
