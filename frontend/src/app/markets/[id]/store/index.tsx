import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { STATUS_LABELS } from "@/components/offer-card";
import { Tappable } from "@/components/tappable";
import { Body, Button, colors, ErrorText, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { Market, MyProposal, ProductSummary } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type StorePage = {
  market: Market;
  proposals: MyProposal[];
  products: ProductSummary[];
};

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(
    useCallback(async (): Promise<StorePage> => {
      const [market, proposals, products] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<MyProposal[]>(`/markets/${id}/proposals`),
        api<ProductSummary[]>(`/markets/${id}/products`),
      ]);
      return { market, proposals, products };
    }, [id]),
  );

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }
  const { market, proposals, products } = data;

  return (
    <Screen>
      {proposals.length > 0 && (
        <>
          <Text style={styles.heading}>Asked to sell</Text>
          {proposals.map((proposal) => (
            <Tappable
              key={proposal.id}
              style={styles.row}
              accessibilityRole="button"
              onPress={() => router.push(`/markets/${id}/proposals/${proposal.id}`)}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{proposal.product_name}</Text>
                <Text style={styles.small}>
                  From {proposal.creator_display_name}, expires{" "}
                  {new Date(proposal.expires_at).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.price}>
                {proposal.price.toLocaleString()} {market.currency_name}
              </Text>
            </Tappable>
          ))}
        </>
      )}

      <Text style={styles.heading}>Products</Text>
      {products.length === 0 && <Body>Nothing here yet. Add the first product.</Body>}
      {products.map((product) => (
        <Tappable
          key={product.id}
          style={styles.row}
          accessibilityRole="button"
          onPress={() => router.push(`/markets/${id}/store/${product.id}`)}
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.small}>
              {STATUS_LABELS[product.status]}
              {product.offer_count > 0 &&
                ` · ${product.offer_count} ${product.offer_count === 1 ? "seller" : "sellers"}`}
            </Text>
          </View>
          {product.lowest_price !== null && (
            <Text style={styles.price}>
              {product.offer_count > 1 ? "from " : ""}
              {product.lowest_price.toLocaleString()} {market.currency_name}
            </Text>
          )}
        </Tappable>
      ))}

      <Button title="New product" onPress={() => router.push(`/markets/${id}/store/new`)} />
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flexShrink: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  price: { fontSize: 16, fontWeight: "600", color: colors.text },
});
