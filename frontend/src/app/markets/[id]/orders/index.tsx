import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text } from "react-native";

import { OrderRow } from "@/components/order-row";
import { Body, colors, ErrorText, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { Market, Order } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type OrdersPage = { market: Market; orders: Order[] };

const ACTIVE: Order["status"][] = [
  "open",
  "done_claimed",
  "disputed",
  "missed",
  "new_deadline_asked",
  "cancel_pending",
];

export default function OrdersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(
    useCallback(async (): Promise<OrdersPage> => {
      const [market, orders] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<Order[]>(`/markets/${id}/orders`),
      ]);
      return { market, orders };
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
  const { market, orders } = data;
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const sections = [
    {
      title: "To deliver",
      list: active.filter((o) => o.role === "seller"),
      empty: "Nothing to do.",
    },
    { title: "Bought", list: active.filter((o) => o.role === "buyer"), empty: "Nothing waiting." },
    { title: "Past", list: orders.filter((o) => !ACTIVE.includes(o.status)), empty: "None yet." },
  ];

  return (
    <Screen>
      <Body>
        Orders you sell and orders you bought. The coins of an open order stay held until it ends.
      </Body>
      {sections.map((section) => (
        <SectionList key={section.title} title={section.title} empty={section.empty}>
          {section.list.map((order) => (
            <OrderRow key={order.id} order={order} marketId={id} currency={market.currency_name} />
          ))}
        </SectionList>
      ))}
    </Screen>
  );
}

function SectionList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      {children.length === 0 ? <Body>{empty}</Body> : children}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
});
