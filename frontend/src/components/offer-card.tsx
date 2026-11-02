// One seller's offer, with everything a buyer should know before buying.
import { StyleSheet, Text, View } from "react-native";

import { formatDuration } from "@/components/duration-picker";
import { colors } from "@/components/ui";
import type { Offer, ProductStatus } from "@/lib/types";

export const STATUS_LABELS: Record<ProductStatus, string> = {
  waiting: "Waiting for sellers",
  live: "Live",
  no_sellers: "No sellers",
  closed: "Closed",
};

const when = (date: string) => new Date(date).toLocaleString();

/** "Guaranteed until …", or null when the offer isn't committed. */
export function commitmentBadge(offer: Offer): string | null {
  if (!offer.committed) return null;
  const until = offer.committed_until && `until ${when(offer.committed_until)}`;
  const stock = offer.committed_stock !== null && `for ${offer.committed_stock} more purchases`;
  if (until && stock) {
    return offer.commitment_release === "all"
      ? `Guaranteed ${until} and ${stock}`
      : `Guaranteed ${until} or ${stock}, whichever ends first`;
  }
  return `Guaranteed ${until || stock}`;
}

export function offerDetails(offer: Offer): string[] {
  const details = [
    offer.delivery === "deadline"
      ? `Done within ${formatDuration(offer.duration_seconds)} of buying`
      : `On request, within ${formatDuration(offer.duration_seconds)} of buying`,
    offer.refundable ? `Refundable (${offer.refund_percent}% back)` : "Not refundable",
  ];
  if (offer.stock !== null) details.push(`${offer.stock} left`);
  if (offer.remove_at) details.push(`Available until ${when(offer.remove_at)}`);
  return details;
}

export function OfferCard({ offer, currency }: { offer: Offer; currency: string }) {
  const badge = commitmentBadge(offer);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.seller}>{offer.is_mine ? "You" : offer.seller_display_name}</Text>
        <Text style={styles.price}>
          {offer.price.toLocaleString()} {currency}
        </Text>
      </View>
      {offerDetails(offer).map((line) => (
        <Text key={line} style={styles.detail}>
          {line}
        </Text>
      ))}
      {badge && <Text style={styles.badge}>{badge}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  seller: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    flexShrink: 1,
  },
  price: { fontSize: 16, fontWeight: "700", color: colors.text },
  detail: { fontSize: 14, color: colors.muted },
  badge: { fontSize: 14, fontWeight: "600", color: "#2E7D32" },
});
