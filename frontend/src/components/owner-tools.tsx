// What a product's owners can do: sell it themselves, edit it, see proposals, ask more sellers,
// manage co-owners, and close it. With several owners, changes wait for the others to approve.
// Each section shows its own mistakes, right under its button.
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
import { Body, Button, colors, ErrorText, Field, TimeLeft } from "@/components/ui";
import { api } from "@/lib/api";
import type { Member, Product } from "@/lib/types";
import { Mistake, useAction } from "@/lib/use-action";

const DAY = 86400;

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

/** A whole number of coins, at least 1, or a mistake explaining what's wrong. */
function coins(text: string): number {
  const value = Number(text);
  if (!text || !Number.isInteger(value) || value < 1) {
    throw new Mistake("Enter a price of at least 1.");
  }
  return value;
}

export function OwnerTools({
  product,
  members,
  me,
  path,
  reload,
}: {
  product: Product;
  members: Member[];
  /** Your username. */
  me: string;
  path: string;
  reload: () => Promise<void> | void;
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

  const sellingMyself = useAction(reload);
  const editing = useAction(reload);
  const proposing = useAction(reload);
  const owning = useAction(reload);
  const closing = useAction(reload);

  const shared = product.owners.length > 1;
  const closed = product.status === "closed";
  const selling = product.offers.some((o) => o.is_mine);
  // Only proposals still waiting for an answer. Answered ones show up as sellers (or don't).
  const waiting = product.proposals.filter((p) => p.status === "pending");
  const waitingForMe = waiting.some((p) => p.seller_username === me);
  // Members who don't sell it already and have no proposal waiting.
  const busy = new Set([
    me,
    ...product.offers.map((o) => o.seller_username),
    ...waiting.map((p) => p.seller_username),
  ]);
  const canAsk = members.filter((m) => !busy.has(m.username));
  const owners = new Set(product.owners.map((o) => o.username));
  const canOwn = members.filter((m) => !owners.has(m.username));

  function save() {
    return editing.run(async () => {
      // Only what changed, so a request shows exactly what it changes.
      const body: Record<string, unknown> = { expires_in_seconds: answerTime };
      if (name.trim() !== product.name) body.name = name;
      if (description.trim() !== product.description) body.description = description;
      if (!("name" in body) && !("description" in body)) throw new Mistake("Nothing changed.");
      if ("name" in body && !name.trim()) throw new Mistake("The name can’t be empty.");
      await api(path, { method: "PATCH", body });
    });
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
            closing.run(() =>
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
            owning.run(() =>
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

      {!selling && !closed && !waitingForMe && (
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
              sellingMyself.run(() =>
                api(`${path}/my-offer`, {
                  method: "POST",
                  body: { price: coins(myPrice), terms: termsToSend(terms) },
                }),
              )
            }
          />
          <ErrorText>{sellingMyself.error}</ErrorText>
        </Foldable>
      )}

      <Foldable title="Name and description">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        {shared && <AnswerTime seconds={answerTime} onChange={setAnswerTime} />}
        <Button title={shared ? "Ask the other owners" : "Save"} onPress={save} />
        <ErrorText>{editing.error}</ErrorText>
      </Foldable>

      <Foldable title={`Proposals waiting for an answer (${waiting.length})`}>
        {waiting.length === 0 && <Body>None waiting.</Body>}
        {waiting.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.rowText}>
              {p.seller_display_name}: {p.price.toLocaleString()}
            </Text>
            <TimeLeft until={p.expires_at} style={styles.small} />
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
                  proposing.run(async () => {
                    if (sellers.length === 0) throw new Mistake("Pick at least one member.");
                    await api(`${path}/proposals`, {
                      method: "POST",
                      body: { sellers, price: coins(price), expires_in_seconds: proposalTime },
                    });
                    setSellers([]);
                  })
                }
              />
              <ErrorText>{proposing.error}</ErrorText>
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
                owning.run(async () => {
                  if (!newOwner[0]) throw new Mistake("Pick someone first.");
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
        <ErrorText>{owning.error}</ErrorText>
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
          <ErrorText>{closing.error}</ErrorText>
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
