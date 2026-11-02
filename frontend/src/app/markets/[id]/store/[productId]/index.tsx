import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Chips } from "@/components/controls";
import { formatDuration } from "@/components/duration-picker";
import { OfferCard, STATUS_LABELS } from "@/components/offer-card";
import { OwnerTools } from "@/components/owner-tools";
import { RequestCard } from "@/components/request-card";
import { Body, Button, colors, ErrorText, Loading, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Market, Member, Offer, Order, Product } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type ProductPage = { market: Market; product: Product; members: Member[] };

export default function ProductScreen() {
  const { id, productId } = useLocalSearchParams<{
    id: string;
    productId: string;
  }>();
  const path = `/markets/${id}/products/${productId}`;
  const { session } = useSession();
  const me = session.state === "ready" ? session.profile.username : "";
  const [order, setOrder] = useState<"cheapest" | "priciest">("cheapest");
  const [error, setError] = useState("");
  const {
    data,
    error: loadError,
    reload,
  } = useLoad(
    useCallback(async (): Promise<ProductPage> => {
      const [market, product, members] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<Product>(path),
        api<Member[]>(`/markets/${id}/members`),
      ]);
      return { market, product, members };
    }, [id, path]),
  );

  async function act(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (!data) {
    return (
      <Screen>
        <ErrorText>{loadError}</ErrorText>
        {!loadError && <Loading />}
      </Screen>
    );
  }
  const { market, product, members } = data;
  const offers = order === "cheapest" ? product.offers : [...product.offers].reverse();
  const mine = product.offers.find((o) => o.is_mine);

  function stopSelling() {
    if (!mine) return;
    Alert.alert("Stop selling?", "Your offer will be removed from this product.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Stop selling",
        style: "destructive",
        onPress: () =>
          act(() =>
            api(`/markets/${id}/offers/${mine.id}`, {
              method: "DELETE",
            }),
          ),
      },
    ]);
  }

  function buy(offer: Offer) {
    const when =
      offer.delivery === "deadline"
        ? `It's due within ${formatDuration(offer.duration_seconds)}.`
        : `You can ask for it within ${formatDuration(offer.duration_seconds)}.`;
    const refund = offer.refundable
      ? `You can cancel before then and get ${offer.refund_percent}% back.`
      : "It isn't refundable.";
    Alert.alert(
      `Buy from ${offer.seller_display_name}?`,
      `${offer.price.toLocaleString()} ${market.currency_name} leave your balance now and are held until the order ends. ${when} ${refund}`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Buy",
          onPress: () =>
            act(async () => {
              const order = await api<Order>(`/markets/${id}/offers/${offer.id}/buy`, {
                method: "POST",
              });
              router.push(`/markets/${id}/orders/${order.id}`);
            }),
        },
      ],
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: product.name }} />
      {product.description !== "" && <Body>{product.description}</Body>}
      <Text style={styles.small}>
        {STATUS_LABELS[product.status]} · owned by{" "}
        {product.owners.length === 0
          ? "no one"
          : product.owners.map((o) => (o.username === me ? "you" : o.display_name)).join(", ")}
        {" · "}
        {product.coin_mode === "to_seller" ? "the coins go to the seller" : "the coins vanish"}
      </Text>

      <Text style={styles.heading}>Sellers</Text>
      {offers.length === 0 && <Body>No one sells this yet.</Body>}
      {offers.length > 1 && (
        <Chips
          options={[
            { value: "cheapest", label: "Cheapest first" },
            { value: "priciest", label: "Most expensive first" },
          ]}
          selected={[order]}
          onChange={([chosen]) => setOrder(chosen)}
        />
      )}
      {offers.map((offer) => (
        <View key={offer.id} style={styles.buttons}>
          <OfferCard offer={offer} currency={market.currency_name} />
          {!offer.is_mine && offer.stock !== 0 && (
            <Button
              title={`Buy for ${offer.price.toLocaleString()} ${market.currency_name}`}
              onPress={() => buy(offer)}
            />
          )}
        </View>
      ))}
      {mine && (
        <View style={styles.buttons}>
          <Button
            title="Change my offer"
            kind="secondary"
            onPress={() => router.push(`/markets/${id}/store/${productId}/my-offer`)}
          />
          {!mine.committed && (
            <Button title="Stop selling" kind="secondary" onPress={stopSelling} />
          )}
        </View>
      )}

      {product.requests.length > 0 && <Text style={styles.heading}>Waiting for approval</Text>}
      {product.requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          forMe={request.kind === "add_owner" && request.member?.username === me}
          onAnswer={(approve) =>
            act(() =>
              api(`/markets/${id}/product-requests/${request.id}/${approve ? "approve" : "decline"}`, {
                method: "POST",
              }),
            )
          }
          onCancel={() =>
            act(() => api(`/markets/${id}/product-requests/${request.id}`, { method: "DELETE" }))
          }
        />
      ))}

      {product.can_claim && (
        <>
          <Body>This product has no owners left. As one of its sellers, you can take it over.</Body>
          <Button
            title="Become its owner"
            onPress={() => act(() => api(`${path}/claim`, { method: "POST" }))}
          />
        </>
      )}

      <ErrorText>{error}</ErrorText>
      {product.is_mine && (
        <OwnerTools product={product} members={members} me={me} path={path} act={act} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  small: { fontSize: 13, color: colors.muted },
  buttons: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowText: { fontSize: 15, color: colors.text, flexShrink: 1 },
});
