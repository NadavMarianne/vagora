import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text } from "react-native";

import { OrderRow, timers } from "@/components/order-row";
import { Body, ErrorText, Info, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { Market, Order } from "@/lib/types";
import { useLoad, useReloadAt } from "@/lib/use-load";
import { useStyles } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

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
  const { data, error, reload } = useLoad(
    useCallback(async (): Promise<OrdersPage> => {
      const [market, orders] = await Promise.all([
        api<Market>(`/markets/${id}`),
        api<Order[]>(`/markets/${id}/orders`),
      ]);
      return { market, orders };
    }, [id]),
  );

  // When any order's timer runs out, show what happened without waiting for a tap.
  useReloadAt(data?.orders.flatMap(timers) ?? [], reload);

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
      <Info title="Your orders">
        Tap an order to see what happened and what to do next. While an order is open, its price is
        held: nobody has it until the order ends.
      </Info>
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
  const styles = useStyles(makeStyles);
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      {children.length === 0 ? <Body>{empty}</Body> : children}
    </>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    heading: { fontSize: 18, fontFamily: t.fonts.bold, color: t.colors.text, marginTop: 8 },
  });
