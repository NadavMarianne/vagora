// A market's settings, in foldable categories. Used when creating a market and in its settings.
// New categories (like the shop or earning rules) go here as more Foldables.
import { getCalendars } from "expo-localization";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Chips, Foldable, Toggle } from "@/components/controls";
import { Tappable } from "@/components/tappable";
import { TimeZonePicker } from "@/components/time-zone-picker";
import { Body, Button, colors, Field, useRevealFocused } from "@/components/ui";
import type { Allowance, AllowanceSchedule, MarketSettings, Weekday } from "@/lib/types";

export function phoneTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? "UTC";
}

const defaultSchedule: AllowanceSchedule = {
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
    allowances: [],
  };
}

// Allowances being edited carry a key, so each keeps its place on screen while others are
// added or removed. The key never goes to the backend.
type DraftAllowance = Allowance & { key: string };
export type SettingsDraft = Omit<MarketSettings, "allowances"> & { allowances: DraftAllowance[] };

let nextKey = 0;
const newKey = () => `new-${nextKey++}`;

/** Turns settings from the backend into a draft for the form. */
export function toDraft(settings: MarketSettings): SettingsDraft {
  return {
    ...settings,
    allowances: settings.allowances.map((a) => ({ ...a, key: String(a.id ?? newKey()) })),
  };
}

/** What to send to the backend. */
export function settingsToSend(draft: SettingsDraft): MarketSettings {
  return { ...draft, allowances: draft.allowances.map(({ key: _key, ...a }) => a) };
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
  const reveal = useRevealFocused();
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
            onFocus={reveal}
          />
          {times.length > 1 && (
            <Tappable onPress={() => onChange(times.filter((_, i) => i !== index))}>
              <Text style={styles.remove}>Remove</Text>
            </Tappable>
          )}
        </View>
      ))}
      <Tappable onPress={() => onChange([...times, "21:00"])}>
        <Text style={styles.add}>+ Add a time</Text>
      </Tappable>
    </View>
  );
}

/** A short line describing an allowance, like "10 · weekly Sun, Wed · 09:00". */
function summary(allowance: Allowance): string {
  const { frequency, weekdays, days, times } = allowance.schedule;
  const when =
    frequency === "weekly"
      ? `weekly ${WEEKDAYS.filter((d) => weekdays.includes(d.value))
          .map((d) => d.label)
          .join(", ")}`
      : frequency === "monthly"
        ? `monthly on ${days.join(", ")}`
        : "daily";
  return `${allowance.amount} · ${when} · ${times.join(", ")}${allowance.enabled ? "" : " (off)"}`;
}

function AllowanceEditor({
  value,
  onChange,
  onRemove,
}: {
  value: DraftAllowance;
  onChange: (value: DraftAllowance) => void;
  onRemove: () => void;
}) {
  const set = (changes: Partial<Allowance>) => onChange({ ...value, ...changes });
  const setSchedule = (changes: Partial<AllowanceSchedule>) =>
    set({ schedule: { ...value.schedule, ...changes } });
  const { schedule } = value;

  return (
    <Foldable title={`${value.name || "New allowance"}: ${summary(value)}`} startOpen={!value.id}>
      <Field
        label="Name (shown on each payment)"
        value={value.name}
        onChangeText={(name) => set({ name })}
        placeholder="e.g. Pocket money"
      />
      <Toggle label="On" value={value.enabled} onChange={(enabled) => set({ enabled })} />
      <CoinsField label="Amount each time" value={value.amount} onChange={(amount) => set({ amount })} />
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
      <Button title="Remove this allowance" kind="secondary" onPress={onRemove} />
    </Foldable>
  );
}

export function MarketSettingsForm({
  value,
  onChange,
}: {
  value: SettingsDraft;
  onChange: (value: SettingsDraft) => void;
}) {
  const set = (changes: Partial<SettingsDraft>) => onChange({ ...value, ...changes });
  const setAllowances = (allowances: DraftAllowance[]) => set({ allowances });

  function addAllowance() {
    setAllowances([
      ...value.allowances,
      { key: newKey(), name: "", amount: 0, enabled: true, schedule: defaultSchedule },
    ]);
  }

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

      <Foldable title={`Allowances (${value.allowances.length})`}>
        <Body>Coins everyone gets on a schedule. Add as many as you like.</Body>
        {value.allowances.map((allowance) => (
          <AllowanceEditor
            key={allowance.key}
            value={allowance}
            onChange={(changed) =>
              setAllowances(value.allowances.map((a) => (a.key === allowance.key ? changed : a)))
            }
            onRemove={() =>
              setAllowances(value.allowances.filter((a) => a.key !== allowance.key))
            }
          />
        ))}
        <Button title="+ Add an allowance" kind="secondary" onPress={addAllowance} />
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
