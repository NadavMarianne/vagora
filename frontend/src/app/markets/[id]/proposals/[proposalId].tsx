import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import {
  defaultTerms,
  OfferTermsForm,
  type TermsDraft,
  termsToSend,
} from "@/components/offer-terms-form";
import { Body, Button, ErrorText, Loading, Screen, Title } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Market, MyProposal, Product } from "@/lib/types";

export default function ProposalScreen() {
  const { id, proposalId } = useLocalSearchParams<{
    id: string;
    proposalId: string;
  }>();
  const [proposal, setProposal] = useState<MyProposal | null>(null);
  const [currency, setCurrency] = useState("");
  const [terms, setTerms] = useState<TermsDraft>(defaultTerms);
  const [error, setError] = useState("");
  const path = `/markets/${id}/proposals/${proposalId}`;

  useEffect(() => {
    Promise.all([api<Market>(`/markets/${id}`), api<MyProposal[]>(`/markets/${id}/proposals`)])
      .then(([market, proposals]) => {
        setCurrency(market.currency_name);
        const found = proposals.find((p) => String(p.id) === proposalId);
        if (found) setProposal(found);
        else setError("This proposal isn't waiting any more.");
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong."));
  }, [id, proposalId]);

  async function answer(accept: boolean) {
    setError("");
    try {
      if (accept) {
        const product = await api<Product>(`${path}/accept`, {
          method: "POST",
          body: termsToSend(terms),
        });
        router.replace(`/markets/${id}/store/${product.id}`);
      } else {
        await api(`${path}/decline`, { method: "POST" });
        router.back();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  if (!proposal) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Loading />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{proposal.product_name}</Title>
      {proposal.product_description !== "" && <Body>{proposal.product_description}</Body>}
      <Body>
        {proposal.creator_display_name} asks you to sell this for {proposal.price.toLocaleString()}{" "}
        {currency}. When an order is done, the coins{" "}
        {proposal.coin_mode === "to_seller" ? "go to you" : "vanish"}.
      </Body>
      <Body>
        Accepting is a promise: you can’t refuse an order placed on your offer. Answer by{" "}
        {new Date(proposal.expires_at).toLocaleString()}.
      </Body>
      <Title>Your terms</Title>
      <OfferTermsForm draft={terms} onChange={setTerms} />
      <ErrorText>{error}</ErrorText>
      <Button title="Accept" onPress={() => answer(true)} />
      <Button title="Decline" kind="secondary" onPress={() => answer(false)} />
    </Screen>
  );
}
