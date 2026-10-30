import { router } from "expo-router";
import { useState } from "react";

import {
  defaultSettings,
  MarketSettingsForm,
  type SettingsDraft,
  settingsToSend,
  toDraft,
} from "@/components/market-settings-form";
import { Body, Button, ErrorText, Field, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Market } from "@/lib/types";

export default function NewMarket() {
  const [name, setName] = useState("");
  const [currencyName, setCurrencyName] = useState("");
  const [settings, setSettings] = useState<SettingsDraft>(() => toDraft(defaultSettings()));
  const [error, setError] = useState("");

  async function create() {
    setError("");
    try {
      const market = await api<Market>("/markets", {
        method: "POST",
        body: { name, currency_name: currencyName, ...settingsToSend(settings) },
      });
      router.replace(`/markets/${market.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <Screen>
      <Field label="Market name" value={name} onChangeText={setName} placeholder="e.g. Home" />
      <Field
        label="Currency name"
        value={currencyName}
        onChangeText={setCurrencyName}
        placeholder="e.g. hearts"
      />
      <Body>Everything else has a sensible default. Open Settings to change it.</Body>
      <MarketSettingsForm value={settings} onChange={setSettings} />
      <ErrorText>{error}</ErrorText>
      <Button title="Create market" onPress={create} />
    </Screen>
  );
}
