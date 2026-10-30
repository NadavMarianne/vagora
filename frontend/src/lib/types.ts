// What the backend sends and accepts. Mirrors backend/app/markets.py and app/allowance.py.

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type AllowanceSchedule = {
  frequency: "daily" | "weekly" | "monthly";
  times: string[]; // "HH:MM"
  weekdays: Weekday[];
  days: number[]; // 1 to 31
};

/** Coins every member gets on a schedule. A new one has no `id` yet. */
export type Allowance = {
  id?: number;
  name: string;
  amount: number;
  enabled: boolean;
  schedule: AllowanceSchedule;
};

/** The settings a market can change (everything except its name and currency name). */
export type MarketSettings = {
  starting_amount: number;
  time_zone: string;
  transfers_enabled: boolean;
  allowances: Allowance[];
};

export type Market = MarketSettings & {
  id: number;
  name: string;
  currency_name: string;
  my_balance: number;
};

export type LedgerEntry = {
  amount: number;
  kind: string;
  note: string;
  created_at: string;
};

export type Member = {
  username: string;
  display_name: string;
  joined_at: string;
};

export type TimeZone = {
  id: string;
  city: string;
  region: string;
  offset: string;
};
