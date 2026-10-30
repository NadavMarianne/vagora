import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { Chips, Toggle } from "@/components/controls";
import { DurationPicker } from "@/components/duration-picker";
import {
  defaultTerms,
  OfferTermsForm,
  type TermsDraft,
  termsToSend,
} from "@/components/offer-terms-form";
import { SellerPicker } from "@/components/seller-picker";
import { Body, Button, ErrorText, Field, Loading, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { CoinMode, Member, Product } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

const DAY = 86400;

export default function NewProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session.state === "ready" ? session.profile.username : "";
  const members = useLoad(useCallback(() => api<Member[]>(`/markets/${id}/members`), [id]));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coinMode, setCoinMode] = useState<CoinMode>("to_seller");
  const [price, setPrice] = useState("");
  const [sellers, setSellers] = useState<string[]>([]);
  const [expiry, setExpiry] = useState(3 * DAY);
  const [sellMyself, setSellMyself] = useState(false);
  const [terms, setTerms] = useState<TermsDraft>(defaultTerms);
  const [error, setError] = useState("");

  async function create() {
    setError("");
    try {
      const product = await api<Product>(`/markets/${id}/products`, {
        method: "POST",
        body: {
          name,
          description,
          coin_mode: coinMode,
          price: Number(price),
          proposal_expiry_seconds: expiry,
          sellers,
          my_offer: sellMyself ? termsToSend(terms) : null,
        },
      });
      router.replace(`/markets/${id}/store/${product.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (!members.data) {
    return (
      <Screen>
        <ErrorText>{members.error}</ErrorText>
        {!members.error && <Loading />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Massage" />
      <Field
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Field
        label="Price"
        value={price}
        onChangeText={(text) => setPrice(text.replace(/\D/g, ""))}
        keyboardType="number-pad"
      />
      <Chips
        label="When an order is done, the coins"
        options={[
          { value: "to_seller", label: "Go to the seller" },
          { value: "vanish", label: "Vanish" },
        ]}
        selected={[coinMode]}
        onChange={([mode]) => setCoinMode(mode)}
      />

      <SellerPicker
        members={members.data.filter((m) => m.username !== me)}
        selected={sellers}
        onChange={setSellers}
      />
      {sellers.length > 0 && (
        <>
          <DurationPicker
            label="They have this long to answer"
            seconds={expiry}
            onChange={setExpiry}
            min={10}
            max={30 * DAY}
          />
          <Body>Each one can accept, with their own terms, or decline.</Body>
        </>
      )}

      <Toggle label="I'll sell it too" value={sellMyself} onChange={setSellMyself} />
      {sellMyself && <OfferTermsForm draft={terms} onChange={setTerms} />}

      <ErrorText>{error}</ErrorText>
      <Button title="Create product" onPress={create} />
    </Screen>
  );
}
