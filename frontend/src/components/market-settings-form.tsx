// A market's settings, in foldable categories. Used when creating a market and in its settings.
// New categories (like the shop or earning rules) go here as more Foldables.
import { getCalendars } from "expo-localization";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Chips, Foldable, Toggle } from "@/components/controls";
import { TimeZonePicker } from "@/components/time-zone-picker";
import { Body, colors, Field } from "@/components/ui";
import type { AllowanceSchedule, MarketSettings, Weekday } from "@/lib/types";

export function phoneTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? "UTC";
}

export const defaultSchedule: AllowanceSchedule = {
  frequency: "weekly",
  times: ["09:00"],
  weekdays: ["sunday"],
  days: [1],
};

export function defaultSettings(): MarketSettings {
  return {
    starting_amount: 0,
    time_zone: phoneTimeZone(),
    transfers_enabled: false,
    allowance_enabled: false,
    allowance_amount: 0,
    allowance_schedule: null,
  };
}

/** What to send to the backend: no schedule while the allowance is off. */
export function settingsToSend(settings: MarketSettings): MarketSettings {
  return settings.allowance_enabled ? settings : { ...settings, allowance_schedule: null };
}

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "sunday", label: "Sun" },
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
];

const DAYS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

function CoinsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field
      label={label}
      value={String(value)}
      onChangeText={(text) => onChange(Number(text.replace(/\D/g, "")) || 0)}
      keyboardType="number-pad"
    />
  );
}

function TimesEditor({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  return (
    <View style={styles.times}>
      <Text style={styles.label}>Times (24-hour, like 09:00)</Text>
      {times.map((time, index) => (
        <View key={index} style={styles.timeRow}>
          <TextInput
            style={styles.timeInput}
            value={time}
            onChangeText={(text) => onChange(times.map((t, i) => (i === index ? text : t)))}
            placeholder="09:00"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          {times.length > 1 && (
            <Pressable onPress={() => onChange(times.filter((_, i) => i !== index))}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}
      <Pressable onPress={() => onChange([...times, "21:00"])}>
        <Text style={styles.add}>+ Add a time</Text>
      </Pressable>
    </View>
  );
}

export function MarketSettingsForm({
  value,
  onChange,
}: {
  value: MarketSettings;
  onChange: (value: MarketSettings) => void;
}) {
  const set = (changes: Partial<MarketSettings>) => onChange({ ...value, ...changes });
  const schedule = value.allowance_schedule ?? defaultSchedule;
  const setSchedule = (changes: Partial<AllowanceSchedule>) =>
    set({ allowance_schedule: { ...schedule, ...changes } });

  return (
    <Foldable title="Settings">
      <Foldable title="General">
        <CoinsField
          label="Starting amount (coins each new member gets)"
          value={value.starting_amount}
          onChange={(starting_amount) => set({ starting_amount })}
        />
        <TimeZonePicker value={value.time_zone} onChange={(time_zone) => set({ time_zone })} />
        <Toggle
          label="Members can send coins to each other"
          value={value.transfers_enabled}
          onChange={(transfers_enabled) => set({ transfers_enabled })}
        />
      </Foldable>

      <Foldable title="Allowance">
        <Toggle
          label="Give everyone coins on a schedule"
          value={value.allowance_enabled}
          onChange={(allowance_enabled) =>
            set({ allowance_enabled, allowance_schedule: value.allowance_schedule ?? schedule })
          }
        />
        {value.allowance_enabled && (
          <>
            <CoinsField
              label="Amount each time"
              value={value.allowance_amount}
              onChange={(allowance_amount) => set({ allowance_amount })}
            />
            <Chips
              label="How often"
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
              selected={[schedule.frequency]}
              onChange={([frequency]) => setSchedule({ frequency })}
            />
            {schedule.frequency === "weekly" && (
              <Chips
                label="Which days"
                multiple
                options={WEEKDAYS}
                selected={schedule.weekdays}
                onChange={(weekdays) => setSchedule({ weekdays })}
              />
            )}
            {schedule.frequency === "monthly" && (
              <>
                <Chips
                  label="Which dates"
                  multiple
                  options={DAYS}
                  selected={schedule.days}
                  onChange={(days) => setSchedule({ days })}
                />
                <Body>A date a month doesn’t have, like the 31st, means its last day.</Body>
              </>
            )}
            <TimesEditor times={schedule.times} onChange={(times) => setSchedule({ times })} />
            <Body>Times are in the market’s time zone.</Body>
          </>
        )}
      </Foldable>
    </Foldable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  times: { gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 90,
    color: colors.text,
  },
  remove: { color: colors.error },
  add: { color: colors.primary, fontWeight: "600" },
});
