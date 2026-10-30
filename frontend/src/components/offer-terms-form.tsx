// A seller's terms for an offer (decision 0021): delivery, refunds, stock, commitment, and
// automatic removal. Dates are picked as "from now", and turned into dates when sent.
import { StyleSheet, View } from "react-native";

import { Chips, Toggle } from "@/components/controls";
import { DurationPicker } from "@/components/duration-picker";
import { Body, Field } from "@/components/ui";
import type { Commitment, Offer, OfferTerms } from "@/lib/types";

const DAY = 86400;
const YEAR = 365 * DAY;

export type TermsDraft = {
  delivery: OfferTerms["delivery"];
  duration_seconds: number;
  refundable: boolean;
  refund_percent: number;
  limitStock: boolean;
  stock: number;
  commit: boolean;
  commitBy: "time" | "stock" | "both";
  commitFor: number; // seconds from now
  commitStock: number;
  release: Commitment["release"];
  removeLater: boolean;
  removeAfter: number; // seconds from now
};

export function defaultTerms(): TermsDraft {
  return {
    delivery: "deadline",
    duration_seconds: 3 * DAY,
    refundable: true,
    refund_percent: 100,
    limitStock: false,
    stock: 5,
    commit: false,
    commitBy: "time",
    commitFor: 7 * DAY,
    commitStock: 1,
    release: "first",
    removeLater: false,
    removeAfter: 30 * DAY,
  };
}

/** Seconds from now until a date, at least 10. */
function fromNow(date: string): number {
  return Math.max(10, Math.round((new Date(date).getTime() - Date.now()) / 1000));
}

/** Turns an existing offer's terms into a draft for editing. */
export function termsOf(offer: Offer): TermsDraft {
  const draft = defaultTerms();
  return {
    ...draft,
    delivery: offer.delivery,
    duration_seconds: offer.duration_seconds,
    refundable: offer.refundable,
    refund_percent: offer.refund_percent,
    limitStock: offer.stock !== null,
    stock: offer.stock ?? draft.stock,
    removeLater: offer.remove_at !== null,
    removeAfter: offer.remove_at ? fromNow(offer.remove_at) : draft.removeAfter,
  };
}

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

/** What to send to the backend. */
export function termsToSend(draft: TermsDraft): OfferTerms {
  const byTime = draft.commitBy !== "stock";
  const byStock = draft.commitBy !== "time";
  return {
    delivery: draft.delivery,
    duration_seconds: draft.duration_seconds,
    refundable: draft.refundable,
    refund_percent: draft.refund_percent,
    stock: draft.limitStock ? draft.stock : null,
    commitment: draft.commit
      ? {
          until: byTime ? inSeconds(draft.commitFor) : null,
          stock: byStock ? draft.commitStock : null,
          release: draft.release,
        }
      : null,
    remove_at: draft.removeLater ? inSeconds(draft.removeAfter) : null,
  };
}

function digits(text: string): number {
  return Number(text.replace(/\D/g, "")) || 0;
}

export function OfferTermsForm({
  draft,
  onChange,
  allowCommitment = true,
}: {
  draft: TermsDraft;
  onChange: (draft: TermsDraft) => void;
  allowCommitment?: boolean;
}) {
  const set = (changes: Partial<TermsDraft>) => onChange({ ...draft, ...changes });
  const onRequest = draft.delivery === "on_request";

  return (
    <View style={styles.form}>
      <Chips
        label="Delivery"
        options={[
          { value: "deadline", label: "Fixed deadline" },
          { value: "on_request", label: "On client's request" },
        ]}
        selected={[draft.delivery]}
        onChange={([delivery]) => set({ delivery })}
      />
      <DurationPicker
        label={onRequest ? "The buyer can ask for it within" : "Done within"}
        seconds={draft.duration_seconds}
        onChange={(duration_seconds) => set({ duration_seconds })}
        min={10}
        max={YEAR}
      />
      <Body>
        {onRequest
          ? "Counted from the purchase. The buyer asks you in person, any time until then."
          : "Counted from the purchase."}
      </Body>

      <Toggle
        label="Refundable"
        value={draft.refundable}
        onChange={(refundable) => set({ refundable })}
      />
      {draft.refundable && (
        <Field
          label="Refund (% of the price)"
          value={String(draft.refund_percent)}
          onChangeText={(text) => set({ refund_percent: Math.min(100, digits(text)) })}
          keyboardType="number-pad"
        />
      )}
      <Body>
        {draft.refundable
          ? onRequest
            ? "The buyer can cancel until the time is up, and gets this back if it's never used."
            : "The buyer can cancel before the deadline and gets this back."
          : "The buyer can't cancel, but can ask you for a refund."}
      </Body>

      <Toggle
        label="Limited stock"
        value={draft.limitStock}
        onChange={(limitStock) => set({ limitStock })}
      />
      {draft.limitStock && (
        <Field
          label="How many can be bought"
          value={String(draft.stock)}
          onChangeText={(text) => set({ stock: digits(text) })}
          keyboardType="number-pad"
        />
      )}

      {allowCommitment && (
        <>
          <Toggle
            label="Commit to this offer"
            value={draft.commit}
            onChange={(commit) => set({ commit })}
          />
          {draft.commit && (
            <>
              <Body>
                While committed, you can’t remove or change the offer. You can only lower the price
                (and raise it back), or extend the commitment.
              </Body>
              <Chips
                label="Commit by"
                options={[
                  { value: "time", label: "Time" },
                  { value: "stock", label: "Purchases" },
                  { value: "both", label: "Both" },
                ]}
                selected={[draft.commitBy]}
                onChange={([commitBy]) => set({ commitBy })}
              />
              {draft.commitBy !== "stock" && (
                <DurationPicker
                  label="Guaranteed for"
                  seconds={draft.commitFor}
                  onChange={(commitFor) => set({ commitFor })}
                  min={10}
                  max={YEAR}
                />
              )}
              {draft.commitBy !== "time" && (
                <Field
                  label="Guaranteed for this many purchases"
                  value={String(draft.commitStock)}
                  onChangeText={(text) => set({ commitStock: digits(text) })}
                  keyboardType="number-pad"
                />
              )}
              {draft.commitBy === "both" && (
                <Chips
                  label="Released"
                  options={[
                    {
                      value: "first",
                      label: "When the first runs out",
                    },
                    {
                      value: "all",
                      label: "When both run out",
                    },
                  ]}
                  selected={[draft.release]}
                  onChange={([release]) => set({ release })}
                />
              )}
            </>
          )}
        </>
      )}

      <Toggle
        label="Remove automatically"
        value={draft.removeLater}
        onChange={(removeLater) => set({ removeLater })}
      />
      {draft.removeLater && (
        <DurationPicker
          label="Remove after"
          seconds={draft.removeAfter}
          onChange={(removeAfter) => set({ removeAfter })}
          min={10}
          max={YEAR}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
});
