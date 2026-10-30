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

/** An open invite, as the market's members see it: who is invited. */
export type PendingInvite = {
  id: number;
  invited_username: string;
  invited_display_name: string;
  expires_at: string;
};

/** An invite waiting for your answer: which market, and who invited you. */
export type ReceivedInvite = {
  id: number;
  market_id: number;
  market_name: string;
  invited_by_username: string;
  invited_by_display_name: string;
  expires_at: string;
};

// The store. Mirrors backend/app/store.py and app/products.py.

/** Where the coins of a completed order go. */
export type CoinMode = "to_seller" | "vanish";

export type Commitment = {
  until: string | null;
  stock: number | null;
  /** With both: released when the first runs out, or only when both have. */
  release: "first" | "all";
};

/** A seller's terms for their offer. */
export type OfferTerms = {
  delivery: "deadline" | "on_request";
  duration_seconds: number;
  refundable: boolean;
  refund_percent: number;
  stock: number | null;
  commitment: Commitment | null;
  remove_at: string | null;
};

export type Offer = {
  id: number;
  seller_username: string;
  seller_display_name: string;
  is_mine: boolean;
  price: number;
  delivery: OfferTerms["delivery"];
  duration_seconds: number;
  refundable: boolean;
  refund_percent: number;
  stock: number | null;
  committed: boolean;
  committed_price: number | null;
  committed_until: string | null;
  committed_stock: number | null;
  commitment_release: "first" | "all" | null;
  remove_at: string | null;
};

export type ProductStatus = "waiting" | "live" | "no_sellers" | "closed";

export type ProductSummary = {
  id: number;
  name: string;
  description: string;
  coin_mode: CoinMode;
  status: ProductStatus;
  creator_username: string;
  creator_display_name: string;
  is_mine: boolean;
  offer_count: number;
  lowest_price: number | null;
};

/** A proposal as the product's creator sees it. */
export type Proposal = {
  id: number;
  seller_username: string;
  seller_display_name: string;
  price: number;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  expires_at: string;
};

export type Product = ProductSummary & {
  proposal_expiry_seconds: number;
  offers: Offer[];
  /** Only the creator gets these. */
  proposals: Proposal[];
};

/** A proposal waiting for your answer. */
export type MyProposal = {
  id: number;
  product_id: number;
  product_name: string;
  product_description: string;
  coin_mode: CoinMode;
  creator_display_name: string;
  price: number;
  expires_at: string;
};
