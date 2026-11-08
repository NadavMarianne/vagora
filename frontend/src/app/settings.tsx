import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Button, ErrorText, Field, Heading, Info, Screen, Small } from "@/components/ui";
import { api } from "@/lib/api";
import { type Profile, useSession } from "@/lib/session";
import { useSetTheme, useStyles, useTheme } from "@/lib/theme";
import { type Theme, THEMES } from "@/lib/themes";
import { Mistake, useAction } from "@/lib/use-action";

export default function SettingsScreen() {
  const styles = useStyles(makeStyles);
  const { session, setProfile } = useSession();
  const profile = session.state === "ready" ? session.profile : null;
  const [name, setName] = useState(profile?.display_name ?? "");
  const saving = useAction();
  const picking = useAction();
  const current = useTheme();
  const setTheme = useSetTheme();

  if (!profile) return null;

  return (
    <Screen>
      <Heading>Profile</Heading>
      <Field label="Display name" value={name} onChangeText={setName} maxLength={30} />
      <Small>Username: @{profile.username} (it can’t be changed)</Small>
      {name.trim() !== profile.display_name && (
        <Button
          title="Save name"
          onPress={() =>
            saving.run(async () => {
              if (!name.trim()) throw new Mistake("Your name can’t be empty.");
              setProfile(
                await api<Profile>("/me", { method: "PATCH", body: { display_name: name } }),
              );
            })
          }
        />
      )}
      <ErrorText>{saving.error}</ErrorText>

      <Heading>Look</Heading>
      <Info>Pick how the app looks for you. Everyone picks their own; others won’t see yours.</Info>
      <View style={styles.grid}>
        {THEMES.map((theme) => (
          <Preview
            key={theme.id}
            theme={theme}
            selected={theme.id === current.id}
            onPress={() => picking.run(() => setTheme(theme.id))}
          />
        ))}
      </View>
      <ErrorText>{picking.error}</ErrorText>
    </Screen>
  );
}

/** A small card drawn in a theme's own colors, fonts, and shapes. */
function Preview({
  theme,
  selected,
  onPress,
}: {
  theme: Theme;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const c = theme.colors;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${theme.name}: ${theme.description}`}
      style={[styles.preview, selected && styles.previewSelected]}
    >
      <View
        style={[
          styles.swatch,
          { backgroundColor: c.background, borderRadius: Math.min(theme.radius.card, 14) },
        ]}
      >
        <View
          style={[
            styles.miniCard,
            {
              backgroundColor: c.balance,
              borderColor: c.border,
              borderWidth: theme.borderWidth,
              borderRadius: Math.min(theme.radius.card, 10),
              boxShadow: theme.shadow.card || undefined,
            },
          ]}
        >
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: c.balanceText }}>
            1,250
          </Text>
        </View>
        <View style={styles.pills}>
          <View
            style={[
              styles.pill,
              { backgroundColor: c.primary, borderRadius: Math.min(theme.radius.button, 8) },
            ]}
          />
          <View style={[styles.dot, { backgroundColor: c.good }]} />
          <View style={[styles.dot, { backgroundColor: c.warning }]} />
          <View style={[styles.dot, { backgroundColor: c.bad }]} />
        </View>
      </View>
      <Text style={styles.name}>{theme.name}</Text>
      <Text style={styles.description}>{theme.description}</Text>
    </Tappable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    preview: {
      width: "47%",
      flexGrow: 1,
      padding: 8,
      gap: 6,
      borderWidth: 2,
      borderColor: "transparent",
      borderRadius: 14,
    },
    previewSelected: { borderColor: t.colors.primary, backgroundColor: t.colors.surfaceAlt },
    swatch: { padding: 10, gap: 8, height: 96, justifyContent: "space-between" },
    miniCard: { paddingHorizontal: 10, paddingVertical: 6 },
    pills: { flexDirection: "row", alignItems: "center", gap: 6 },
    pill: { width: 36, height: 14 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    name: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.text },
    description: { fontSize: 12, fontFamily: t.fonts.regular, color: t.colors.muted },
  });
