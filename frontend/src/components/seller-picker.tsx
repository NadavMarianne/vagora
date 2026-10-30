// Picks which members get a proposal to sell a product: some of them, or everyone at once.
import { Chips } from "@/components/controls";
import { Body } from "@/components/ui";
import type { Member } from "@/lib/types";

const EVERYONE = "*everyone";

export function SellerPicker({
  members,
  selected,
  onChange,
}: {
  /** The members who can be picked. */
  members: Member[];
  selected: string[];
  onChange: (usernames: string[]) => void;
}) {
  if (members.length === 0) return <Body>No other members to ask.</Body>;
  const all = members.map((m) => m.username);
  const everyone = all.every((u) => selected.includes(u));

  return (
    <Chips
      label="Ask them to sell it"
      multiple
      options={[
        { value: EVERYONE, label: "Everyone" },
        ...members.map((m) => ({
          value: m.username,
          label: m.display_name,
        })),
      ]}
      selected={everyone ? [EVERYONE, ...selected] : selected}
      onChange={(next) => {
        const tappedEveryone = next.includes(EVERYONE) !== everyone;
        if (tappedEveryone) onChange(everyone ? [] : all);
        else onChange(next.filter((u) => u !== EVERYONE));
      }}
    />
  );
}
