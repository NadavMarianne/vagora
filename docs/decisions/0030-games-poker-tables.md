# 0030: Games: poker tables

**Date:** 2026-11-14 **Status:** Accepted

## Decision
A market gets a **Games** section. The first game is a **poker table**: the cards are real and dealt by hand, and the app replaces the chips and does all the bookkeeping. Nobody needs physical chips or has to write anything down. The game is **No-Limit Texas Hold'em**, and only the market's currency is played for (no store items).

### Tables
- Any member can open a table. Its settings, fixed while a hand is being played:
  - **Players:** the most who can sit, 2 to 9.
  - **Small blind.** The big blind is always twice the small blind, and the smallest bet is one big blind.
  - **Minimum and maximum buy-in.** By default 20 and 100 big blinds.
  - **Turn timer:** off, or a number of seconds. When it runs out, the player checks if checking is allowed, and folds otherwise.
  - With a timer, each betting round first waits for its cards. Whoever pressed deal taps "Cards are out", and only then betting and the timer start (if the dealer got up, anyone still in the hand can tap it). Without a timer there's no wait. Added after the second test game.
- **Sitting down:** a player chooses a buy-in between the minimum and maximum, and those coins move from their balance onto the table (a ledger entry). Coins on a table can't be spent in the store.
- **Topping up** between hands: allowed while the stack is below the maximum buy-in, and only up to it. **Winnings are not capped:** a stack can grow past the maximum, as in a real game.
- **Leaving**: the whole stack goes back to the balance (a ledger entry). A player with no chips left sits out until they top up or leave. Getting up in the middle of a hand counts as folding (decided 2026-11-15): what they bet stays in the pot.
- **Cashing out part** of a stack, between your hands: that much goes back to the balance and you stay seated (added after the first test game).
- **Choosing a seat:** the table is drawn round, with as many seats as its most players. You sit down by tapping an empty seat.
- A hand needs at least two players with chips.

### A hand
1. The app moves the **dealer button**, takes the **blinds** automatically, and tells the dealer to deal two cards to each player. Heads-up (two players), the dealer posts the small blind and acts first before the flop, as in standard rules.
2. **Betting rounds:** preflop, then the flop (3 cards), the turn (1) and the river (1). Before each new round the app says which cards to deal. On their turn, a player sees **Fold, Check or Call, and Bet or Raise**, with the right minimum raise (at least the size of the last bet or raise). Everyone sees each action, the pot and the stacks live.
3. **Folding takes two taps** (Fold, then confirm), so it can't happen by accident. There is no undo.
4. **All-in:** a player can always bet their whole stack. Whatever a short stack can't match comes back to the bigger stack, and with three or more players the pot splits into **side pots**, each won only by the players who paid into it.
5. **The end of a hand:**
   - If everyone else folded, the last player wins the pot right away.
   - At a **showdown**, players turn their real cards over. Any player in the hand picks the winner of each pot (or several, for a split), and **every other player still in the hand confirms**. Nothing moves until all of them agree. A split that doesn't divide evenly gives the odd coin to the first winner after the dealer button.
6. Then the next hand can start.

### Bookkeeping
- **Skins** (decided 2026-11-15, redone 2026-11-19 and 2026-11-25): whoever opens a table picks how it looks, from "Table decorations" in the form. Three kinds: colors (white, black, red, orange, green (the usual), blue, purple), art felts, each after a real art tradition (black marble, a gold mosaic after Klimt, paper cut-outs after Matisse, a starry night), and special ones (suits and chips drawn in fine lines in even rows, royal, casino), each in a few colors, picked from a small menu that opens when the felt is tapped. Colors always come in one order: white, black, red, orange, green, blue, purple. Each color is its own name (`suits-blue`), so the table still stores one name. Patterns keep away from (or fade under) the spots where each player's cards and chips lie. The table stores the skin's name, the backend accepts only names on its list, and the app draws each one. A name that's no longer offered shows as green.
- **Colors on the felt follow one rule** (2026-11-19): everything drawn on the felt (writing, card outlines, the hourglass, the gold of the pot and timer, the red of the last seconds) is worked out from the felt's color with WCAG's contrast rule, never picked by hand. Writing is white or near-black, whichever stands out more (at least 4.5 to 1). The gold and the red keep their hue and get lighter on dark felts or darker on light ones until they reach 3 to 1, WCAG's level for large bold writing and shapes. Writing and card outlines get a soft edge in the opposite color, and busy felts keep their middle calm, so the board and the pot read on every felt. Seats have their own solid background, since they hang over the felt's edge.
- Stacks live on the table. The ledger records only sitting down, topping up, cashing out and leaving, so balances stay exact and every movement is in each person's history.
- The total of all stacks and pots on a table always equals what was bought in minus what was taken out. The tests check this after every action.
- Actions are checked on the backend (whose turn, the allowed amounts), and two taps at the same moment can't both count.
- The turn timer is applied when anyone next loads or acts at the table, the same way deadlines are caught up elsewhere (no scheduler). When it applies a run-out turn, everyone at the table is told, so every screen moves on.

## Why
Playing a card game for the market's currency should feel like a real table: the cards in hand, and the chips handled for you. Making the app the chips (not the cards) keeps the fun of real cards and needs no hidden information on the phones. Up to 9 players covers a full table, so the same feature works for two people or a group. The showdown needs everyone in the hand to agree because the app can't see the cards.

## Alternatives considered
- **Buy in, play with physical chips, type in the final counts:** the least work, but it needs chips and doesn't follow the game.
- **Sending coins to each other after each hand:** simple, but clunky every hand, with no pot and no agreement.
- **Full digital poker (the app deals, hands hidden on each phone):** much more work, and it replaces the real cards.
- **Undo of the last action:** more forgiving, but complicates the rules. A two-tap fold covers the costly mistake.
- **Betting store items:** an item has no value to compare with coins except its price, so it would only add complexity. Maybe later.
