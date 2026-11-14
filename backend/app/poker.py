"""The rules of a No-Limit Texas Hold'em hand, as plain data (decision 0030).

The cards are real and dealt by hand, so this only follows the chips: the blinds, whose turn it
is, what each player may do, the betting rounds, all-ins and side pots, and who gets what at the
end. Nothing here touches the database (app/hands.py saves a hand as this data), which keeps the
rules easy to test on their own.

Seats are numbered 0 to 8 clockwise. "After" a seat means the next one clockwise.
"""

from dataclasses import asdict, dataclass, field
from typing import Literal

Street = Literal["preflop", "flop", "turn", "river", "showdown", "done"]
Action = Literal["fold", "check", "call", "raise", "all_in"]

BETTING: tuple[Street, ...] = ("preflop", "flop", "turn", "river")


class NotAllowed(Exception):
    """The action breaks the rules (not your turn, too small a raise, ...). Says why."""


@dataclass
class Player:
    seat: int
    # Chips in front of them, not yet bet.
    stack: int
    # Bet in this betting round, and in the whole hand.
    street_bet: int = 0
    total: int = 0
    folded: bool = False
    all_in: bool = False
    # Has acted since the last full raise (so the round may be over for them).
    acted: bool = False
    # May still raise. A short all-in that isn't a full raise doesn't let players who already
    # acted raise again; they can only call or fold.
    can_raise: bool = True

    @property
    def in_hand(self) -> bool:
        return not self.folded

    @property
    def can_act(self) -> bool:
        return not self.folded and not self.all_in


@dataclass
class Pot:
    amount: int
    # Who can win it: the players still in the hand who paid into all of it.
    eligible: list[int]


@dataclass
class Hand:
    players: list[Player]
    button: int
    small_blind_seat: int
    big_blind_seat: int
    small_blind: int
    street: Street = "preflop"
    # Whose turn it is. Empty when nobody acts (between rounds, at the showdown, or when done).
    to_act: int | None = None
    # The highest bet in this round, and the smallest raise on top of it.
    current_bet: int = 0
    min_raise: int = 0
    # The last street that was bet on before the showdown, so the dealer knows what's dealt.
    reached: Street = "preflop"
    # What happened, in order: {"seat", "action", "amount"} (amount: the bet's new total).
    log: list[dict] = field(default_factory=list)
    # When done: how many chips each seat gets back from the pots.
    payouts: dict[int, int] = field(default_factory=dict)

    @property
    def big_blind(self) -> int:
        return 2 * self.small_blind

    def player(self, seat: int) -> Player:
        for p in self.players:
            if p.seat == seat:
                return p
        raise NotAllowed("That seat isn't in this hand.")

    def after(self, seat: int) -> list[Player]:
        """Every player, clockwise, starting with the one after this seat."""
        ordered = sorted(self.players, key=lambda p: p.seat)
        later = [p for p in ordered if p.seat > seat]
        earlier = [p for p in ordered if p.seat <= seat]
        return later + earlier

    def in_hand(self) -> list[Player]:
        return [p for p in self.players if p.in_hand]

    # --- Saving -------------------------------------------------------------------------

    def to_data(self) -> dict:
        data = asdict(self)
        data["payouts"] = {str(seat): amount for seat, amount in self.payouts.items()}
        return data

    @classmethod
    def from_data(cls, data: dict) -> "Hand":
        data = dict(data)
        data["players"] = [Player(**p) for p in data["players"]]
        data["payouts"] = {int(seat): amount for seat, amount in data.get("payouts", {}).items()}
        return cls(**data)


# --- Starting a hand ------------------------------------------------------------------------


def next_button(seats: list[int], previous: int | None) -> int:
    """The dealer button for a new hand: the next playing seat after the last button."""
    ordered = sorted(seats)
    if previous is None:
        return ordered[0]
    return next((s for s in ordered if s > previous), ordered[0])


def start(stacks: dict[int, int], previous_button: int | None, small_blind: int) -> Hand:
    """Starts a hand for the seats with chips (seat number: stack), and posts the blinds.

    Heads-up (two players) the button posts the small blind and acts first before the flop.
    """
    seats = sorted(seat for seat, stack in stacks.items() if stack > 0)
    if len(seats) < 2:
        raise NotAllowed("A hand needs at least two players with chips.")
    button = next_button(seats, previous_button)
    players = [Player(seat=s, stack=stacks[s]) for s in seats]

    ordered = sorted(players, key=lambda p: p.seat)
    after_button = [p for p in ordered if p.seat > button] + [
        p for p in ordered if p.seat <= button
    ]
    if len(players) == 2:
        small, big = next(p for p in players if p.seat == button), after_button[0]
    else:
        small, big = after_button[0], after_button[1]

    hand = Hand(
        players=players,
        button=button,
        small_blind_seat=small.seat,
        big_blind_seat=big.seat,
        small_blind=small_blind,
    )
    _pay(small, small_blind)
    _pay(big, hand.big_blind)
    hand.log += [
        {"seat": small.seat, "action": "small_blind", "amount": small.street_bet},
        {"seat": big.seat, "action": "big_blind", "amount": big.street_bet},
    ]
    # The amount to call is the full big blind, even when the big blind was short.
    hand.current_bet = hand.big_blind
    hand.min_raise = hand.big_blind
    _move_on(hand, after=big.seat)
    return hand


def _pay(player: Player, amount: int) -> int:
    """Moves chips from a stack into the bet (all of it if the stack is shorter). Returns how
    many."""
    paid = min(amount, player.stack)
    player.stack -= paid
    player.street_bet += paid
    player.total += paid
    if player.stack == 0:
        player.all_in = True
    return paid


# --- Acting -------------------------------------------------------------------------------


def to_call(hand: Hand, seat: int) -> int:
    """How much more this player has to put in to stay (at most their stack)."""
    p = hand.player(seat)
    return max(0, min(hand.current_bet - p.street_bet, p.stack))


def raise_range(hand: Hand, seat: int) -> tuple[int, int] | None:
    """The smallest and biggest total this player may bet or raise to in this round, or None if
    they can't raise. Going all-in is always allowed, even below a full raise."""
    p = hand.player(seat)
    most = p.street_bet + p.stack
    if not p.can_raise or most <= hand.current_bet:
        return None
    least = min(hand.current_bet + hand.min_raise, most)
    return least, most


def act(hand: Hand, seat: int, action: Action, amount: int | None = None) -> None:
    """One player's action. `amount` is the bet's new total in this round, for a raise."""
    if hand.street not in BETTING or hand.to_act is None:
        raise NotAllowed("Nobody is betting right now.")
    if hand.to_act != seat:
        raise NotAllowed("It isn't your turn.")
    p = hand.player(seat)
    owed = hand.current_bet - p.street_bet

    if action == "all_in":
        allowed = raise_range(hand, seat)
        if allowed is None:
            action = "call" if owed > 0 else "check"
        else:
            action, amount = "raise", allowed[1]

    if action == "fold":
        p.folded = True
    elif action == "check":
        if owed > 0:
            raise NotAllowed(f"You can't check: it's {owed} to call.")
    elif action == "call":
        if owed <= 0:
            raise NotAllowed("There's nothing to call. Check instead.")
        _pay(p, owed)
    elif action == "raise":
        allowed = raise_range(hand, seat)
        if allowed is None:
            raise NotAllowed("You can't raise now: only call or fold.")
        least, most = allowed
        if amount is None or not least <= amount <= most:
            raise NotAllowed(f"You can bet or raise to {least} up to {most}.")
        raised_by = amount - hand.current_bet
        full = raised_by >= hand.min_raise
        _pay(p, amount - p.street_bet)
        for other in hand.players:
            if other.seat == seat or not other.can_act:
                continue
            if full:
                other.can_raise = True
            elif other.acted:
                # A short all-in: they must answer it, but may not raise again.
                other.can_raise = False
            other.acted = False
        if full:
            hand.min_raise = raised_by
        hand.current_bet = amount
    else:
        raise NotAllowed("Unknown action.")

    p.acted = True
    hand.log.append({"seat": seat, "action": action, "amount": p.street_bet})
    _move_on(hand, after=seat)


def time_out(hand: Hand) -> None:
    """The player whose turn it is ran out of time: they check if they can, or fold."""
    if hand.to_act is None:
        return
    seat = hand.to_act
    act(hand, seat, "check" if to_call(hand, seat) == 0 else "fold")
    hand.log[-1]["timed_out"] = True


def fold_out(hand: Hand, seat: int) -> None:
    """Takes a player out of the hand out of turn (they left the market). Their bets stay in."""
    p = hand.player(seat)
    if hand.street == "done" or p.folded:
        return
    if hand.street == "showdown":
        p.folded = True
        hand.log.append({"seat": seat, "action": "fold", "amount": p.street_bet})
        if len(hand.in_hand()) == 1:
            _award_all(hand, hand.in_hand()[0].seat)
        elif not contested(hand):
            settle(hand, [])
        return
    if hand.to_act == seat:
        act(hand, seat, "fold")
        return
    p.folded = True
    hand.log.append({"seat": seat, "action": "fold", "amount": p.street_bet})
    _move_on(hand, after=hand.to_act if hand.to_act is not None else seat, keep_turn=True)


# --- Moving through the hand --------------------------------------------------------------


def _round_over(hand: Hand) -> bool:
    return all(p.all_in or (p.acted and p.street_bet == hand.current_bet) for p in hand.in_hand())


def _move_on(hand: Hand, after: int, keep_turn: bool = False) -> None:
    """After an action: ends the hand, ends the round, or passes the turn on."""
    alive = hand.in_hand()
    if len(alive) == 1:
        _award_all(hand, alive[0].seat)
        return
    if not _round_over(hand):
        if keep_turn and hand.to_act is not None and hand.player(hand.to_act).can_act:
            return
        hand.to_act = next(
            p.seat
            for p in hand.after(after)
            if p.can_act and (not p.acted or p.street_bet < hand.current_bet)
        )
        return

    hand.reached = hand.street
    able = [p for p in alive if p.can_act]
    if hand.street == "river" or len(able) <= 1:
        _to_showdown(hand)
        return
    hand.street = BETTING[BETTING.index(hand.street) + 1]
    for p in hand.players:
        p.street_bet = 0
        p.acted = False
        p.can_raise = True
    hand.current_bet = 0
    hand.min_raise = hand.big_blind
    hand.to_act = next(p.seat for p in hand.after(hand.button) if p.can_act)


def _to_showdown(hand: Hand) -> None:
    hand.street = "showdown"
    hand.to_act = None
    # Pots only one player can win (like a bet nobody could match) go to them now.
    contested = [pot for pot in pots(hand) if len(pot.eligible) > 1]
    if not contested:
        settle(hand, [])


def _award_all(hand: Hand, seat: int) -> None:
    """Everyone else folded: the last player gets every chip in the middle."""
    hand.reached = hand.street if hand.street in BETTING else hand.reached
    hand.street = "done"
    hand.to_act = None
    hand.payouts = {seat: sum(p.total for p in hand.players)}
    hand.player(seat).stack += hand.payouts[seat]


# --- Pots and the end ---------------------------------------------------------------------


def pots(hand: Hand) -> list[Pot]:
    """The main pot and any side pots, from the bets so far.

    Each level of all-in makes a new pot: every player pays into it up to that level, and only
    players still in the hand who paid the whole level can win it. Chips folded players bet
    above the last level join the last pot.
    """
    alive = hand.in_hand()
    levels = sorted({p.total for p in alive})
    result: list[Pot] = []
    previous = 0
    for i, level in enumerate(levels):
        top = i == len(levels) - 1
        amount = sum(
            (p.total if top else min(p.total, level)) - min(p.total, previous) for p in hand.players
        )
        eligible = sorted(p.seat for p in alive if p.total >= level)
        if amount > 0:
            result.append(Pot(amount=amount, eligible=eligible))
        previous = level
    return result


def contested(hand: Hand) -> list[Pot]:
    """The pots more than one player can win: the ones the showdown has to decide."""
    return [pot for pot in pots(hand) if len(pot.eligible) > 1]


def settle(hand: Hand, winners: list[list[int]]) -> None:
    """Ends the hand at the showdown. `winners` names who won each contested pot, in order
    (several players split it). Uncontested pots go to their only player.

    A split that doesn't divide evenly gives the odd chips one each to the winners closest
    clockwise after the button.
    """
    if hand.street != "showdown":
        raise NotAllowed("The hand isn't at the showdown.")
    fights = contested(hand)
    if len(winners) != len(fights):
        raise NotAllowed(f"Say who won each of the {len(fights)} pots.")
    clockwise = [p.seat for p in hand.after(hand.button)]
    payouts: dict[int, int] = {}
    chosen = iter(winners)
    for pot in pots(hand):
        if len(pot.eligible) == 1:
            seats = pot.eligible
        else:
            named = set(next(chosen))
            if not named or not named <= set(pot.eligible):
                raise NotAllowed("A pot's winners must be players who can win it.")
            seats = sorted(named, key=clockwise.index)
        share, odd = divmod(pot.amount, len(seats))
        for i, seat in enumerate(seats):
            payouts[seat] = payouts.get(seat, 0) + share + (1 if i < odd else 0)
    for seat, amount in payouts.items():
        hand.player(seat).stack += amount
    hand.payouts = payouts
    hand.street = "done"
