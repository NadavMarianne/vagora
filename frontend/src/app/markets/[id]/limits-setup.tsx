import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { cleanLines, type DraftLine, LimitsEditor, toDraft } from "@/components/limits-editor";
import { Button, ErrorText, Info, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/** A new member's first step in a market: their limits file. It can be left empty. */
export default function LimitsSetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState<DraftLine[]>(() => toDraft([""]));
  const saving = useAction();
  const lines = cleanLines(draft);

  function save() {
    return saving.run(async () => {
      await api(`/markets/${id}/limits`, { method: "PUT", body: { lines } });
      router.replace(`/markets/${id}`);
    });
  }

  return (
    <Screen>
      <Title>Your limits</Title>
      <Info>
        Before you start: write down anything that must never be asked of you, one per line.
        Everyone in the market can see these, and no punishment can ever include them. This first
        time is free, and so is your next edit. You can always remove lines for free, from your
        member page.
      </Info>
      <LimitsEditor value={draft} onChange={setDraft} />
      <Button title={lines.length ? "Save my limits" : "Nothing for now"} onPress={save} />
      <ErrorText>{saving.error}</ErrorText>
    </Screen>
  );
}
