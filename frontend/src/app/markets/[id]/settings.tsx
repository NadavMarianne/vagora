import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { MarketSettingsForm, settingsToSend } from "@/components/market-settings-form";
import { Body, Button, ErrorText, Field, Loading, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Market, MarketSettings } from "@/lib/types";

export default function MarketSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [currencyName, setCurrencyName] = useState("");
  const [settings, setSettings] = useState<MarketSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Market>(`/markets/${id}`)
      .then((market) => {
        setName(market.name);
        setCurrencyName(market.currency_name);
        setSettings({
          starting_amount: market.starting_amount,
          time_zone: market.time_zone,
          transfers_enabled: market.transfers_enabled,
          allowance_enabled: market.allowance_enabled,
          allowance_amount: market.allowance_amount,
          allowance_schedule: market.allowance_schedule,
        });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong."));
  }, [id]);

  async function save() {
    if (!settings) return;
    setError("");
    try {
      await api<Market>(`/markets/${id}`, {
        method: "PATCH",
        body: { name, currency_name: currencyName, ...settingsToSend(settings) },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (!settings) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label="Market name" value={name} onChangeText={setName} />
      <Field label="Currency name" value={currencyName} onChangeText={setCurrencyName} />
      <MarketSettingsForm value={settings} onChange={setSettings} />
      <Body>Any member can change these. Changing the allowance schedule starts it fresh.</Body>
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
    </Screen>
  );
}
