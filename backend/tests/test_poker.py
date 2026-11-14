"""The poker rules on their own (app/poker.py), with no database."""

import random

import pytest

from app import poker
from app.poker import NotAllowed


def chips(hand: poker.Hand) -> int:
    """Every chip in the hand: stacks plus everything bet (already paid out once done)."""
    in_middle = 0 if hand.street == "done" else sum(p.total for p in hand.players)
    return sum(p.stack for p in hand.players) + in_middle


def check_down(hand: poker.Hand) -> None:
    """Everyone just calls or checks until the showdown."""
    while hand.to_act is not None:
        seat = hand.to_act
        poker.act(hand, seat, "call" if poker.to_call(hand, seat) else "check")


# --- Starting -------------------------------------------------------------------------------


def test_heads_up_the_button_posts_the_small_blind_and_acts_first():
    hand = poker.start({2: 1000, 5: 1000}, previous_button=None, small_blind=5)

    assert hand.button == 2
    assert (hand.small_blind_seat, hand.big_blind_seat) == (2, 5)
    assert (hand.player(2).stack, hand.player(5).stack) == (995, 990)
    assert hand.to_act == 2
    assert poker.to_call(hand, 2) == 5


def test_heads_up_the_big_blind_acts_first_after_the_flop():
    hand = poker.start({2: 1000, 5: 1000}, previous_button=None, small_blind=5)
    poker.act(hand, 2, "call")
    poker.act(hand, 5, "check")

    assert hand.street == "flop"
    assert hand.to_act == 5


def test_three_players_the_blinds_follow_the_button_and_the_next_one_starts():
    hand = poker.start({0: 500, 3: 500, 7: 500}, previous_button=0, small_blind=5)

    assert hand.button == 3
    assert (hand.small_blind_seat, hand.big_blind_seat) == (7, 0)
    assert hand.to_act == 3


def test_the_button_skips_empty_seats_and_wraps_around():
    assert poker.next_button([1, 4, 6], previous=4) == 6
    assert poker.next_button([1, 4, 6], previous=6) == 1
    assert poker.next_button([1, 4, 6], previous=5) == 6
    assert poker.next_button([1, 4, 6], previous=None) == 1


def test_players_without_chips_sit_this_hand_out():
    hand = poker.start({0: 0, 1: 300, 2: 300}, previous_button=None, small_blind=5)

    assert [p.seat for p in hand.players] == [1, 2]


def test_a_hand_needs_two_players_with_chips():
    with pytest.raises(NotAllowed):
        poker.start({0: 300, 1: 0}, previous_button=None, small_blind=5)


def test_a_short_big_blind_goes_all_in_but_calling_costs_the_full_blind():
    hand = poker.start({0: 1000, 1: 1000, 2: 4}, previous_button=None, small_blind=5)

    assert hand.big_blind_seat == 2
    assert hand.player(2).all_in
    assert hand.player(2).total == 4
    assert poker.to_call(hand, 0) == 10


# --- Betting ------------------------------------------------------------------------------


def test_checking_all_the_way_goes_through_every_street_to_the_showdown():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=None, small_blind=5)
    streets = []
    while hand.to_act is not None:
        if hand.street not in streets:
            streets.append(hand.street)
        seat = hand.to_act
        poker.act(hand, seat, "call" if poker.to_call(hand, seat) else "check")

    assert streets == ["preflop", "flop", "turn", "river"]
    assert hand.street == "showdown"
    assert [(p.amount, p.eligible) for p in poker.pots(hand)] == [(30, [0, 1, 2])]


def test_the_big_blind_can_raise_after_everyone_just_calls():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "call")
    poker.act(hand, 1, "call")

    assert hand.to_act == 2
    assert poker.raise_range(hand, 2) == (20, 1000)


def test_you_cant_check_facing_a_bet_or_call_when_nothing_is_owed():
    hand = poker.start({0: 1000, 1: 1000}, previous_button=None, small_blind=5)

    with pytest.raises(NotAllowed, match="to call"):
        poker.act(hand, 0, "check")
    poker.act(hand, 0, "call")
    with pytest.raises(NotAllowed, match="Check instead"):
        poker.act(hand, 1, "call")


def test_only_the_player_whose_turn_it_is_can_act():
    hand = poker.start({0: 1000, 1: 1000}, previous_button=None, small_blind=5)

    with pytest.raises(NotAllowed, match="your turn"):
        poker.act(hand, 1, "fold")


def test_a_raise_must_be_at_least_the_last_raise():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=None, small_blind=5)

    with pytest.raises(NotAllowed, match="20 up to 1000"):
        poker.act(hand, 0, "raise", 15)
    poker.act(hand, 0, "raise", 50)  # raised by 40
    assert poker.raise_range(hand, 1) == (90, 1000)
    with pytest.raises(NotAllowed):
        poker.act(hand, 1, "raise", 89)
    poker.act(hand, 1, "raise", 90)


def test_the_smallest_bet_after_the_flop_is_the_big_blind():
    hand = poker.start({0: 1000, 1: 1000}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "call")
    poker.act(hand, 1, "check")

    assert poker.raise_range(hand, 1) == (10, 990)


def test_a_raise_gives_everyone_another_turn():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "call")
    poker.act(hand, 1, "call")
    poker.act(hand, 2, "raise", 40)

    assert hand.street == "preflop"
    assert hand.to_act == 0
    poker.act(hand, 0, "call")
    poker.act(hand, 1, "call")
    assert hand.street == "flop"


# --- Folding --------------------------------------------------------------------------------


def test_when_everyone_else_folds_the_last_player_takes_the_pot():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "raise", 100)
    poker.act(hand, 1, "fold")
    poker.act(hand, 2, "fold")

    assert hand.street == "done"
    assert hand.payouts == {0: 115}
    assert [p.stack for p in hand.players] == [1015, 995, 990]


# --- All-in and side pots -------------------------------------------------------------------


def test_a_short_all_in_call_gets_back_nothing_it_didnt_cover():
    hand = poker.start({0: 1000, 1: 300}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "raise", 600)
    poker.act(hand, 1, "call")  # all-in for 300

    assert hand.street == "showdown"
    assert hand.reached == "preflop"
    assert [(p.amount, p.eligible) for p in poker.pots(hand)] == [(600, [0, 1]), (300, [0])]

    poker.settle(hand, [[1]])

    assert hand.payouts == {1: 600, 0: 300}
    assert (hand.player(0).stack, hand.player(1).stack) == (700, 600)


def test_three_way_all_ins_make_side_pots():
    hand = poker.start({0: 100, 1: 300, 2: 1000}, previous_button=2, small_blind=5)
    # Button 0, small blind 1, big blind 2, and seat 0 starts.
    poker.act(hand, 0, "all_in")
    poker.act(hand, 1, "all_in")
    poker.act(hand, 2, "call")

    assert hand.street == "showdown"
    assert [(p.amount, p.eligible) for p in poker.pots(hand)] == [
        (300, [0, 1, 2]),
        (400, [1, 2]),
    ]

    # The short stack wins the main pot, the big stack the side pot.
    poker.settle(hand, [[0], [2]])

    assert hand.payouts == {0: 300, 2: 400}
    assert [p.stack for p in hand.players] == [300, 0, 1100]


def test_folded_chips_stay_in_the_pot():
    hand = poker.start({0: 1000, 1: 1000, 2: 200}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "raise", 100)
    poker.act(hand, 1, "call")
    poker.act(hand, 2, "all_in")  # 200
    poker.act(hand, 0, "call")
    poker.act(hand, 1, "fold")

    assert hand.street == "showdown"
    assert [(p.amount, p.eligible) for p in poker.pots(hand)] == [(500, [0, 2])]


def test_a_short_all_in_raise_doesnt_let_earlier_players_raise_again():
    hand = poker.start({0: 1000, 1: 1000, 2: 130}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "raise", 100)  # raised by 90
    poker.act(hand, 1, "call")
    poker.act(hand, 2, "all_in")  # to 130: only 30 more, not a full raise

    assert hand.to_act == 0
    assert poker.to_call(hand, 0) == 30
    assert poker.raise_range(hand, 0) is None
    with pytest.raises(NotAllowed, match="only call or fold"):
        poker.act(hand, 0, "raise", 300)
    poker.act(hand, 0, "call")
    poker.act(hand, 1, "call")
    assert hand.street == "flop"


def test_a_full_raise_after_a_short_all_in_opens_raising_again():
    hand = poker.start({0: 130, 1: 1000, 2: 1000, 3: 1000}, previous_button=None, small_blind=5)
    # Button 0, small blind 1, big blind 2, and seat 3 starts.
    poker.act(hand, 3, "raise", 100)  # raised by 90
    poker.act(hand, 0, "all_in")  # to 130: short
    # The small blind hasn't acted yet, so it may still make a full raise.
    assert poker.raise_range(hand, 1) == (220, 1000)
    poker.act(hand, 1, "raise", 300)
    poker.act(hand, 2, "fold")

    # That full raise lets seat 3 raise again.
    assert hand.to_act == 3
    assert poker.raise_range(hand, 3) is not None


def test_all_in_before_the_flop_runs_to_the_showdown():
    hand = poker.start({0: 500, 1: 500}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "all_in")
    poker.act(hand, 1, "call")

    assert hand.street == "showdown"
    assert hand.reached == "preflop"
    assert hand.to_act is None


def test_a_bet_nobody_can_match_comes_back_without_a_showdown():
    hand = poker.start({0: 1000, 1: 50}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "raise", 500)
    poker.act(hand, 1, "fold")

    assert hand.street == "done"
    assert hand.payouts == {0: 510}


# --- The showdown ---------------------------------------------------------------------------


def test_a_split_pot_gives_the_odd_chip_clockwise_from_the_button():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=0, small_blind=5)
    # Button 1, small blind 2, big blind 0, and seat 1 starts.
    poker.act(hand, 1, "call")
    poker.act(hand, 2, "fold")  # 5 dead chips: the pot is 25
    check_down(hand)

    poker.settle(hand, [[0, 1]])

    # Clockwise from the button (1): 2, 0, 1. Seat 0 comes first and gets the odd chip.
    assert hand.payouts == {0: 13, 1: 12}


def test_the_showdown_must_name_winners_for_every_contested_pot():
    hand = poker.start({0: 1000, 1: 1000}, previous_button=None, small_blind=5)
    check_down(hand)

    with pytest.raises(NotAllowed, match="each of the 1 pots"):
        poker.settle(hand, [])
    with pytest.raises(NotAllowed, match="can win it"):
        poker.settle(hand, [[4]])


def test_a_folded_player_cant_win():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=0, small_blind=5)
    poker.act(hand, 1, "call")
    poker.act(hand, 2, "fold")
    check_down(hand)

    with pytest.raises(NotAllowed):
        poker.settle(hand, [[2]])


# --- The timer and leaving ------------------------------------------------------------------


def test_running_out_of_time_checks_if_possible_and_folds_otherwise():
    hand = poker.start({0: 1000, 1: 1000}, previous_button=None, small_blind=5)

    poker.time_out(hand)  # seat 0 owes 5
    assert hand.player(0).folded
    assert hand.log[-1]["timed_out"]

    hand = poker.start({0: 1000, 1: 1000}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "call")
    poker.time_out(hand)  # seat 1 owes nothing
    assert not hand.player(1).folded
    assert hand.street == "flop"


def test_a_player_who_leaves_folds_even_out_of_turn():
    hand = poker.start({0: 1000, 1: 1000, 2: 1000}, previous_button=None, small_blind=5)
    # Button 0, small blind 1, big blind 2, and seat 0 starts.

    poker.fold_out(hand, 2)

    assert hand.player(2).folded
    assert hand.to_act == 0
    poker.fold_out(hand, 0)
    assert hand.street == "done"
    assert hand.payouts == {1: 15}


# --- Saving ---------------------------------------------------------------------------------


def test_a_hand_saves_and_loads_unchanged():
    hand = poker.start({0: 1000, 1: 300}, previous_button=None, small_blind=5)
    poker.act(hand, 0, "raise", 600)
    poker.act(hand, 1, "call")
    poker.settle(hand, [[1]])

    assert poker.Hand.from_data(hand.to_data()) == hand


# --- Every chip, every time -----------------------------------------------------------------


@pytest.mark.parametrize("seed", range(40))
def test_random_games_never_lose_or_make_a_chip(seed):
    """Plays many random hands with random legal moves, and checks the rules hold."""
    rng = random.Random(seed)
    stacks = {
        seat: rng.choice([30, 200, 1000, 5000]) for seat in rng.sample(range(9), rng.randint(2, 9))
    }
    total = sum(stacks.values())
    button = None
    for _ in range(60):
        if sum(1 for s in stacks.values() if s > 0) < 2:
            break
        hand = poker.start(stacks, previous_button=button, small_blind=rng.choice([1, 5, 25]))
        button = hand.button
        while hand.street not in ("showdown", "done"):
            assert chips(hand) == sum(stacks[p.seat] for p in hand.players)
            seat = hand.to_act
            player = hand.player(seat)
            assert player.can_act
            choices = ["fold", "all_in"]
            choices.append("call" if poker.to_call(hand, seat) else "check")
            allowed = poker.raise_range(hand, seat)
            if allowed:
                choices.append("raise")
            action = rng.choice(choices)
            amount = rng.randint(*allowed) if action == "raise" else None
            poker.act(hand, seat, action, amount)
        if hand.street == "showdown":
            winners = [
                rng.sample(pot.eligible, rng.randint(1, len(pot.eligible)))
                for pot in poker.contested(hand)
            ]
            poker.settle(hand, winners)
        assert hand.street == "done"
        assert sum(hand.payouts.values()) == sum(p.total for p in hand.players)
        for p in hand.players:
            stacks[p.seat] = p.stack
            assert p.stack >= 0
        assert sum(stacks.values()) == total
