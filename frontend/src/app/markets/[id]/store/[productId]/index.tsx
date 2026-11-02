import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Chips, Foldable } from "@/components/controls";
import { OfferCard, STATUS_LABELS } from "@/components/offer-card";
import { SellerPicker } from "@/components/seller-picker";
import { Body, Button, colors, ErrorText, Field, Loading, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Market, Member, Product, Proposal } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type ProductPage = { market: Market; product: Product; members: Member[] };

const PROPOSAL_STATUS: Record<Proposal["status"], string> = {
  pending: "Waiting",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export default function ProductScreen() {
  const { id, productId } = useLocalSearchParams<{
    id: string;
    productId: string;
  }>();
  const path = `/markets/${id}/products/${productId}`;
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

  return (
    <Screen>
      <Stack.Screen options={{ title: product.name }} />
      {product.description !== "" && <Body>{product.description}</Body>}
      <Text style={styles.small}>
        {STATUS_LABELS[product.status]} · by{" "}
        {product.is_mine ? "you" : product.creator_display_name}
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
        <OfferCard key={offer.id} offer={offer} currency={market.currency_name} />
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

      <ErrorText>{error}</ErrorText>
      {product.is_mine && (
        <CreatorTools product={product} members={members} path={path} act={act} />
      )}
    </Screen>
  );
}

/** What the product's creator can do: edit it, see proposals, ask more sellers, close it. */
function CreatorTools({
  product,
  members,
  path,
  act,
}: {
  product: Product;
  members: Member[];
  path: string;
  act: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [sellers, setSellers] = useState<string[]>([]);
  const [price, setPrice] = useState(String(product.offers[0]?.price ?? ""));

  // Members who don't sell it already and have no proposal waiting.
  const busy = new Set([
    product.creator_username,
    ...product.offers.map((o) => o.seller_username),
    ...product.proposals.filter((p) => p.status === "pending").map((p) => p.seller_username),
  ]);
  const canAsk = members.filter((m) => !busy.has(m.username));
  const closed = product.status === "closed";

  function close() {
    Alert.alert(
      "Close this product?",
      "No new proposals, and offers without a commitment are removed. Committed offers stay until their commitment ends.",
      [
        { text: "Keep it open", style: "cancel" },
        {
          text: "Close",
          style: "destructive",
          onPress: () => act(() => api(`${path}/close`, { method: "POST" })),
        },
      ],
    );
  }

  return (
    <>
      <Text style={styles.heading}>Your product</Text>
      <Foldable title="Name and description">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        <Button
          title="Save"
          onPress={() =>
            act(() =>
              api(path, {
                method: "PATCH",
                body: { name, description },
              }),
            )
          }
        />
      </Foldable>

      <Foldable title={`Proposals (${product.proposals.length})`}>
        {product.proposals.length === 0 && <Body>None sent.</Body>}
        {product.proposals.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.rowText}>
              {p.seller_display_name}, {p.price.toLocaleString()}
            </Text>
            <Text style={styles.small}>{PROPOSAL_STATUS[p.status]}</Text>
          </View>
        ))}
      </Foldable>

      {!closed && (
        <Foldable title="Ask more sellers">
          <SellerPicker members={canAsk} selected={sellers} onChange={setSellers} />
          {canAsk.length > 0 && (
            <>
              <Field
                label="Price"
                value={price}
                onChangeText={(text) => setPrice(text.replace(/\D/g, ""))}
                keyboardType="number-pad"
              />
              <Button
                title="Send proposals"
                onPress={() =>
                  act(async () => {
                    await api(`${path}/proposals`, {
                      method: "POST",
                      body: {
                        sellers,
                        price: Number(price),
                      },
                    });
                    setSellers([]);
                  })
                }
              />
            </>
          )}
        </Foldable>
      )}

      {!closed && <Button title="Close product" kind="secondary" onPress={close} />}
    </>
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
