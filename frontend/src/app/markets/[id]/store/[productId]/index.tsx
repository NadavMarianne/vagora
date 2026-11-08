import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Chips, Foldable } from "@/components/controls";
import { formatDuration } from "@/components/duration-picker";
import { OfferCard, STATUS_LABELS } from "@/components/offer-card";
import { OrderRow } from "@/components/order-row";
import { OwnerTools } from "@/components/owner-tools";
import { RequestCard } from "@/components/request-card";
import { Body, Button, ErrorText, Info, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Market, Member, Offer, Order, Product } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { useLoad } from "@/lib/use-load";
import type { Theme } from "@/lib/themes";
import { useStyles } from "@/lib/theme";

type ProductPage = { market: Market; product: Product; members: Member[]; orders: Order[] };

const ACTIVE: Order["status"][] = [
  "open",
  "done_claimed",
  "disputed",
  "missed",
  "new_deadline_asked",
  "cancel_pending",
];

export default function ProductScreen() {
  const styles = useStyles(makeStyles);
  const { id, productId } = useLocalSearchParams<{
    id: string;
    productId: string;
  }>();
  const path = `/markets/${id}/products/${productId}`;
  const { session } = useSession();
  const me = session.state === "ready" ? session.profile.username : "";
  const [sort, setSort] = useState<"cheapest" | "priciest">("cheapest");
  const {
    data,
    error: loadError,
    reload,
  } = useLoad(
    useCallback(async (): Promise<ProductPage> => {
      const [market, product, members, orders] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<Product>(path),
        api<Member[]>(`/markets/${id}/members`),
        api<Order[]>(`/markets/${id}/orders`),
      ]);
      return { market, product, members, orders };
    }, [id, path]),
  );
  // Each part of the page shows its own mistakes.
  const buying = useAction(reload);
  const selling = useAction(reload);
  const answering = useAction(reload);
  const claiming = useAction(reload);

  if (!data) {
    return (
      <Screen>
        <ErrorText>{loadError}</ErrorText>
        {!loadError && <Loading />}
      </Screen>
    );
  }
  const { market, product, members } = data;
  const currency = market.currency_name;
  const mine = product.offers.find((o) => o.is_mine);
  const others = product.offers.filter((o) => !o.is_mine);
  const sorted = sort === "cheapest" ? others : [...others].reverse();
  // Your orders of this product that haven't ended yet.
  const myOrders = data.orders.filter(
    (o) => o.product_id === product.id && o.role === "buyer" && ACTIVE.includes(o.status),
  );

  function stopSelling() {
    if (!mine) return;
    Alert.alert("Stop selling?", "Your offer will be removed from this product.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Stop selling",
        style: "destructive",
        onPress: () =>
          selling.run(() => api(`/markets/${id}/offers/${mine.id}`, { method: "DELETE" })),
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
      `${offer.price.toLocaleString()} ${currency} leave your balance now and are held until the order ends. ${when} ${refund}`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Buy",
          onPress: () =>
            buying.run(async () => {
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

      {/* What waits for your answer comes first. */}
      {product.requests.length > 0 && (
        <Foldable
          title={`Waiting for approval (${product.requests.length})`}
          startOpen={product.requests.some((r) => r.mine_to_answer)}
        >
          {product.requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              forMe={request.kind === "add_owner" && request.member?.username === me}
              onAnswer={(approve) =>
                answering.run(() =>
                  api(
                    `/markets/${id}/product-requests/${request.id}/${approve ? "approve" : "decline"}`,
                    { method: "POST" },
                  ),
                )
              }
              onCancel={() =>
                answering.run(() =>
                  api(`/markets/${id}/product-requests/${request.id}`, { method: "DELETE" }),
                )
              }
            />
          ))}
          <ErrorText>{answering.error}</ErrorText>
        </Foldable>
      )}

      <Foldable title={`${mine ? "Other sellers" : "Sellers"} (${others.length})`} startOpen>
        {others.length === 0 && (
          <Body>{mine ? "No one else sells this yet." : "No one sells this yet."}</Body>
        )}
        {others.length > 1 && (
          <Chips
            options={[
              { value: "cheapest", label: "Cheapest first" },
              { value: "priciest", label: "Most expensive first" },
            ]}
            selected={[sort]}
            onChange={([chosen]) => setSort(chosen)}
          />
        )}
        {sorted.map((offer) => (
          <View key={offer.id} style={styles.buttons}>
            <OfferCard offer={offer} currency={currency} />
            {offer.stock !== 0 && (
              <Button
                title={`${myOrders.length > 0 ? "Buy again" : "Buy"} for ${offer.price.toLocaleString()} ${currency}`}
                onPress={() => buy(offer)}
              />
            )}
          </View>
        ))}
        <ErrorText>{buying.error}</ErrorText>
        {others.length > 0 && (
          <Info title="How buying works">
            The price leaves your balance as soon as you buy, and is held. When the order is done it{" "}
            {product.coin_mode === "to_seller" ? "goes to the seller" : "vanishes"}. If it’s
            refunded, it comes back to you. You can buy it as many times as you like.
          </Info>
        )}
      </Foldable>

      {myOrders.length > 0 && (
        <Foldable title={`Your open orders of this (${myOrders.length})`}>
          {myOrders.map((o) => (
            <OrderRow key={o.id} order={o} marketId={id} currency={currency} />
          ))}
        </Foldable>
      )}

      {mine && (
        <Foldable title="Your offer">
          <OfferCard offer={mine} currency={currency} />
          <Button
            title="Change my offer"
            kind="secondary"
            onPress={() => router.push(`/markets/${id}/store/${productId}/my-offer`)}
          />
          {!mine.committed && (
            <Button title="Stop selling" kind="secondary" onPress={stopSelling} />
          )}
          <ErrorText>{selling.error}</ErrorText>
        </Foldable>
      )}

      {product.can_claim && (
        <>
          <Body>This product has no owners left. As one of its sellers, you can take it over.</Body>
          <Button
            title="Become its owner"
            onPress={() => claiming.run(() => api(`${path}/claim`, { method: "POST" }))}
          />
          <ErrorText>{claiming.error}</ErrorText>
        </>
      )}

      {product.is_mine && (
        <Foldable title="Manage this product">
          <OwnerTools product={product} members={members} me={me} path={path} reload={reload} />
        </Foldable>
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    small: { fontFamily: t.fonts.regular, fontSize: 13, color: t.colors.muted },
    buttons: { gap: 8 },
  });
