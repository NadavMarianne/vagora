import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { Toggle } from "@/components/controls";
import { DurationPicker } from "@/components/duration-picker";
import { commitmentBadge } from "@/components/offer-card";
import {
  OfferTermsForm,
  type TermsDraft,
  termsOf,
  termsToSend,
} from "@/components/offer-terms-form";
import { Body, Button, ErrorText, Field, Loading, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Offer, Product } from "@/lib/types";

const DAY = 86400;

export default function MyOfferScreen() {
  const { id, productId } = useLocalSearchParams<{
    id: string;
    productId: string;
  }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [price, setPrice] = useState("");
  const [terms, setTerms] = useState<TermsDraft | null>(null);
  const [extendTime, setExtendTime] = useState(false);
  const [extendBy, setExtendBy] = useState(7 * DAY);
  const [committedStock, setCommittedStock] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Product>(`/markets/${id}/products/${productId}`)
      .then((product) => {
        const mine = product.offers.find((o) => o.is_mine);
        if (!mine) return setError("You don't sell this product.");
        setOffer(mine);
        setPrice(String(mine.price));
        setTerms(termsOf(mine));
        setCommittedStock(String(mine.committed_stock ?? ""));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong."));
  }, [id, productId]);

  async function save() {
    if (!offer || !terms) return;
    setError("");
    const body: Record<string, unknown> = { price: Number(price) };
    if (!offer.committed) body.terms = termsToSend(terms);
    else {
      if (extendTime && offer.committed_until) {
        const until = new Date(offer.committed_until).getTime() + extendBy * 1000;
        body.committed_until = new Date(until).toISOString();
      }
      if (offer.committed_stock !== null && Number(committedStock) !== offer.committed_stock) {
        body.committed_stock = Number(committedStock);
      }
    }
    try {
      await api(`/markets/${id}/offers/${offer.id}`, {
        method: "PATCH",
        body,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (!offer || !terms) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Field
        label="Price"
        value={price}
        onChangeText={(text) => setPrice(text.replace(/\D/g, ""))}
        keyboardType="number-pad"
      />
      {offer.committed ? (
        <>
          <Body>{commitmentBadge(offer)}.</Body>
          <Body>
            While committed, you can lower the price and raise it back up to{" "}
            {offer.committed_price?.toLocaleString()}, or extend the commitment.
          </Body>
          {offer.committed_until && (
            <>
              <Toggle label="Extend the time" value={extendTime} onChange={setExtendTime} />
              {extendTime && (
                <DurationPicker
                  label="Extend by"
                  seconds={extendBy}
                  onChange={setExtendBy}
                  min={10}
                  max={365 * DAY}
                />
              )}
            </>
          )}
          {offer.committed_stock !== null && (
            <Field
              label="Guaranteed purchases (can only go up)"
              value={committedStock}
              onChangeText={(text) => setCommittedStock(text.replace(/\D/g, ""))}
              keyboardType="number-pad"
            />
          )}
        </>
      ) : (
        <OfferTermsForm draft={terms} onChange={setTerms} />
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
    </Screen>
  );
}
