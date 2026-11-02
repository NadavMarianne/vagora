// What a product's owners can do: sell it themselves, edit it, see proposals, ask more sellers,
// manage co-owners, and close it. With several owners, changes wait for the others to approve.
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Chips, Foldable } from "@/components/controls";
import { DurationPicker } from "@/components/duration-picker";
import {
  defaultTerms,
  OfferTermsForm,
  type TermsDraft,
  termsToSend,
} from "@/components/offer-terms-form";
import { SellerPicker } from "@/components/seller-picker";
import { Body, Button, colors, Field } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Member, Product, Proposal } from "@/lib/types";

const DAY = 86400;

const PROPOSAL_STATUS: Record<Proposal["status"], string> = {
  pending: "Waiting",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** How long the other owners (or someone invited) have to answer a request. */
function AnswerTime({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  return (
    <DurationPicker
      label="They have this long to answer"
      seconds={seconds}
      onChange={onChange}
      min={10}
      max={30 * DAY}
    />
  );
}

export function OwnerTools({
  product,
  members,
  me,
  path,
  act,
}: {
  product: Product;
  members: Member[];
  /** Your username. */
  me: string;
  path: string;
  act: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [sellers, setSellers] = useState<string[]>([]);
  const [price, setPrice] = useState(String(product.offers[0]?.price ?? ""));
  const [myPrice, setMyPrice] = useState(String(product.offers[0]?.price ?? ""));
  const [terms, setTerms] = useState<TermsDraft>(defaultTerms);
  const [newOwner, setNewOwner] = useState<string[]>([]);
  const [answerTime, setAnswerTime] = useState(3 * DAY);
  const [proposalTime, setProposalTime] = useState(product.proposal_expiry_seconds);

  const shared = product.owners.length > 1;
  const closed = product.status === "closed";
  const selling = product.offers.some((o) => o.is_mine);
  const waitingProposal = product.proposals.some(
    (p) => p.status === "pending" && p.seller_username === me,
  );
  // Members who don't sell it already and have no proposal waiting.
  const busy = new Set([
    me,
    ...product.offers.map((o) => o.seller_username),
    ...product.proposals.filter((p) => p.status === "pending").map((p) => p.seller_username),
  ]);
  const canAsk = members.filter((m) => !busy.has(m.username));
  const owners = new Set(product.owners.map((o) => o.username));
  const canOwn = members.filter((m) => !owners.has(m.username));

  function save() {
    // Only what changed, so a request shows exactly what it changes.
    const body: Record<string, unknown> = { expires_in_seconds: answerTime };
    if (name !== product.name) body.name = name;
    if (description !== product.description) body.description = description;
    return act(() => api(path, { method: "PATCH", body }));
  }

  function close() {
    Alert.alert(
      shared ? "Ask to close this product?" : "Close this product?",
      "No new proposals, and offers without a commitment are removed. Committed offers stay until their commitment ends." +
        (shared ? " The other owners must approve first." : ""),
      [
        { text: "Keep it open", style: "cancel" },
        {
          text: "Close",
          style: "destructive",
          onPress: () =>
            act(() =>
              api(`${path}/close`, { method: "POST", body: { expires_in_seconds: answerTime } }),
            ),
        },
      ],
    );
  }

  function removeOwner(username: string) {
    const self = username === me;
    Alert.alert(
      self ? "Step down as an owner?" : "Ask to remove this owner?",
      self
        ? "You won’t own this product any more."
        : "The other owners must approve first. They aren’t asked themselves.",
      [
        { text: "Back", style: "cancel" },
        {
          text: self ? "Step down" : "Ask",
          style: "destructive",
          onPress: () =>
            act(() =>
              api(`${path}/owners/${username}`, {
                method: "DELETE",
                body: { expires_in_seconds: answerTime },
              }),
            ),
        },
      ],
    );
  }

  return (
    <>
      <Text style={styles.heading}>Your product</Text>
      {shared && <Body>You own this together. Changes wait until every owner approves.</Body>}

      {!selling && !closed && !waitingProposal && (
        <Foldable title="Sell it myself">
          <Field
            label="Your price"
            value={myPrice}
            onChangeText={(text) => setMyPrice(text.replace(/\D/g, ""))}
            keyboardType="number-pad"
          />
          <OfferTermsForm draft={terms} onChange={setTerms} />
          <Button
            title="Start selling"
            onPress={() =>
              act(() =>
                api(`${path}/my-offer`, {
                  method: "POST",
                  body: { price: Number(myPrice), terms: termsToSend(terms) },
                }),
              )
            }
          />
        </Foldable>
      )}

      <Foldable title="Name and description">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        {shared && <AnswerTime seconds={answerTime} onChange={setAnswerTime} />}
        <Button title={shared ? "Ask the other owners" : "Save"} onPress={save} />
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
              <AnswerTime seconds={proposalTime} onChange={setProposalTime} />
              <Button
                title="Send proposals"
                onPress={() =>
                  act(async () => {
                    await api(`${path}/proposals`, {
                      method: "POST",
                      body: { sellers, price: Number(price), expires_in_seconds: proposalTime },
                    });
                    setSellers([]);
                  })
                }
              />
            </>
          )}
        </Foldable>
      )}

      <Foldable title={`Owners (${product.owners.length})`}>
        {product.owners.map((owner) => (
          <View key={owner.username} style={styles.row}>
            <Text style={styles.rowText}>{owner.username === me ? "You" : owner.display_name}</Text>
            {shared && (
              <Button
                title={owner.username === me ? "Step down" : "Remove"}
                kind="secondary"
                onPress={() => removeOwner(owner.username)}
              />
            )}
          </View>
        ))}
        {canOwn.length > 0 && (
          <>
            <Chips
              label="Ask someone to co-own it"
              options={canOwn.map((m) => ({ value: m.username, label: m.display_name }))}
              selected={newOwner}
              onChange={setNewOwner}
            />
            <AnswerTime seconds={answerTime} onChange={setAnswerTime} />
            <Button
              title="Send the request"
              onPress={() =>
                act(async () => {
                  if (!newOwner[0]) throw new ApiError(0, "Pick someone first.");
                  await api(`${path}/owners`, {
                    method: "POST",
                    body: { username: newOwner[0], expires_in_seconds: answerTime },
                  });
                  setNewOwner([]);
                })
              }
            />
            <Body>They must accept{shared ? ", and every owner must approve" : ""}.</Body>
          </>
        )}
      </Foldable>

      {!closed && (
        <Foldable title="Close product">
          <Body>
            No new proposals, and offers without a commitment are removed. Committed offers stay
            until their commitment ends.
          </Body>
          {shared && <AnswerTime seconds={answerTime} onChange={setAnswerTime} />}
          <Button
            title={shared ? "Ask to close it" : "Close product"}
            kind="secondary"
            onPress={close}
          />
        </Foldable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  small: { fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowText: { fontSize: 15, color: colors.text, flexShrink: 1 },
});
