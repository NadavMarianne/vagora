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
  /** After a missed deadline, how long a seller has to contest a cancellation. */
  contest_window_seconds: number;
  /** What an edit of your limits file costs (the coins vanish). */
  limits_edit_price: number;
  allowances: Allowance[];
};

export type Market = MarketSettings & {
  id: number;
  name: string;
  currency_name: string;
  my_balance: number;
  /** Whether you've set your limits file here yet. New members do it first. */
  my_limits_set: boolean;
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

/** A member's page, with their limits file. Mirrors backend/app/limits.py. */
export type MemberPage = {
  username: string;
  display_name: string;
  joined_at: string;
  is_me: boolean;
  limits: string[];
  /** Only on your own page. */
  limits_set: boolean | null;
  next_edit_cost: number | null;
};

export type TimeZone = {
  id: string;
  city: string;
  region: string;
  offset: string;
};

/** A market you left recently. You can rejoin it yourself until `rejoin_until`. */
export type LeftMarket = {
  id: number;
  name: string;
  currency_name: string;
  my_balance: number;
  left_at: string;
  rejoin_until: string;
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
  created_at: string;
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

export type Person = { username: string; display_name: string };

/** A change to a product that every owner must approve. */
export type ProductRequest = {
  id: number;
  kind: "edit" | "close" | "add_owner" | "remove_owner";
  requested_by: Person;
  /** Who's being added or removed as an owner. */
  member: Person | null;
  new_name: string | null;
  new_description: string | null;
  approved: Person[];
  waiting_for: Person[];
  /** It waits for your answer. */
  mine_to_answer: boolean;
  /** You asked for it. */
  mine: boolean;
  created_at: string;
  expires_at: string;
};

export type Product = ProductSummary & {
  proposal_expiry_seconds: number;
  offers: Offer[];
  owners: Person[];
  /** Only owners get these. */
  proposals: Proposal[];
  /** Owners see these, and so does someone asked to co-own. */
  requests: ProductRequest[];
  /** A seller can claim a product that has no owners left. */
  can_claim: boolean;
};

/** A product request in the market waiting for your answer. */
export type WaitingRequest = {
  id: number;
  product_id: number;
  product_name: string;
  kind: ProductRequest["kind"];
  requested_by_display_name: string;
  member_display_name: string | null;
  /** You're the one asked to co-own it. */
  asks_you_to_own: boolean;
  expires_at: string;
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
  created_at: string;
  expires_at: string;
};

export type OrderStatus =
  | "open"
  | "done_claimed"
  | "disputed"
  | "missed"
  | "new_deadline_asked"
  | "cancel_pending"
  | "completed"
  | "cancelled"
  | "discarded"
  | "expired"
  | "not_delivered"
  | "seller_ended";

/** One purchase, as its buyer or seller sees it. Mirrors backend/app/orders.py. */
export type Order = {
  id: number;
  product_id: number;
  product_name: string;
  role: "buyer" | "seller";
  other_display_name: string;
  price: number;
  coin_mode: CoinMode;
  delivery: OfferTerms["delivery"];
  refundable: boolean;
  refund_percent: number;
  status: OrderStatus;
  created_at: string;
  due_at: string;
  /** The last missed deadline, and how many were missed. */
  missed_at: string | null;
  missed_count: number;
  /** A proposed new deadline: how long, when it was asked, and until when the seller can answer. */
  new_deadline_seconds: number | null;
  new_deadline_asked_at: string | null;
  new_deadline_answer_by: string | null;
  /** A cancellation after a missed deadline: when it was made, and when it goes through
   * unless contested. */
  contest_from: string | null;
  contest_until: string | null;
  done_claimed_at: string | null;
  auto_complete_at: string | null;
  refund_requested: boolean;
  ended_at: string | null;
};

/** A message you were sent, kept in your notifications list. Mirrors backend/app/notifications.py. */
export type AppNotification = {
  id: number;
  message: string;
  /** The page it opens, like "/markets/12/orders/3". */
  path: string;
  /** How important it is, which sets its color. */
  level: "info" | "good" | "warning" | "critical";
  created_at: string;
  read: boolean;
};
