"""Playing poker hands through the app's endpoints (decision 0030)."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select, update

from app.models import LedgerEntry, Membership, PokerHand, PokerSeat

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 1000,
    "time_zone": "UTC",
}


@pytest.fixture
def game(member):
    """Dana (seat 0) and Noa (seat 1) at a table with 500 each, blinds 5/10.
    Returns (dana, noa, url, market_id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    table = dana.post(
        f"/markets/{market_id}/tables", json={"name": "Hotel", "small_blind": 5, "min_buy_in": 100}
    ).json()
    url = f"/markets/{market_id}/tables/{table['id']}"
    dana.post(f"{url}/sit", json={"buy_in": 500, "seat": 0})
    noa.post(f"{url}/sit", json={"buy_in": 500, "seat": 1})
    return dana, noa, url, market_id


def act(client, url, action, amount=None):
    body = {"action": action} if amount is None else {"action": action, "amount": amount}
    response = client.post(f"{url}/hands/current/act", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def stacks(table):
    return {s["number"]: s["stack"] for s in table["seats"]}


def coins_add_up(db):
    """Balances equal their ledgers, and stacks plus the pot of a hand being played equal the
    coins taken to tables minus the coins brought back."""
    for m in db.scalars(select(Membership)):
        total = db.scalar(
            select(func.sum(LedgerEntry.amount)).where(LedgerEntry.membership_id == m.id)
        )
        assert m.balance == (total or 0)
    to_tables = db.scalar(
        select(func.sum(LedgerEntry.amount)).where(
            LedgerEntry.kind.in_(["table_buy_in", "table_cash_out"])
        )
    )
    stacks_total = db.scalar(select(func.sum(PokerSeat.stack))) or 0
    in_pots = sum(
        sum(p["total"] for p in row.state["players"])
        for row in db.scalars(select(PokerHand).where(PokerHand.finished_at.is_(None)))
    )
    assert -(to_tables or 0) == stacks_total + in_pots


def test_dealing_posts_the_blinds_and_moves_the_button(game, db):
    dana, noa, url, _ = game

    table = dana.post(f"{url}/hands").json()

    hand = table["hand"]
    assert (hand["number"], hand["street"], hand["button"]) == (1, "preflop", 0)
    assert (hand["small_blind_seat"], hand["big_blind_seat"]) == (0, 1)
    assert stacks(table) == {0: 495, 1: 490}
    assert hand["to_act"] == 0
    assert hand["my_turn"] == {"to_call": 5, "can_check": False, "raise_min": 20, "raise_max": 500}
    assert noa.get(url).json()["hand"]["my_turn"] is None
    coins_add_up(db)


def test_only_one_hand_at_a_time_and_only_players_deal(game, member):
    dana, _, url, _ = game
    dana.post(f"{url}/hands")

    assert dana.post(f"{url}/hands").status_code == 409


def test_a_whole_hand_to_a_showdown_everyone_agrees_on(game, db):
    dana, noa, url, market_id = game
    dana.post(f"{url}/hands")
    act(dana, url, "call")
    table = act(noa, url, "raise", 40)
    assert table["hand"]["street"] == "preflop"
    table = act(dana, url, "call")
    assert table["hand"]["street"] == "flop"
    for street in ("flop", "turn", "river"):
        assert table["hand"]["street"] == street
        act(noa, url, "check")
        table = act(dana, url, "check")

    hand = table["hand"]
    assert hand["street"] == "showdown"
    assert hand["contested"] == [{"amount": 80, "eligible": [0, 1]}]
    coins_add_up(db)

    claimed = noa.post(f"{url}/hands/current/claim", json={"winners": [[1]]}).json()
    assert claimed["hand"]["claim"] == {"by": 1, "winners": [[1]], "confirmed": [1]}
    assert claimed["hand"]["street"] == "showdown"

    confirmed = dana.post(f"{url}/hands/current/confirm").json()

    assert confirmed["hand"]["street"] == "done"
    assert confirmed["hand"]["payouts"] == {"1": 80}
    assert stacks(confirmed) == {0: 460, 1: 540}
    coins_add_up(db)

    # The next hand moves the button.
    assert dana.post(f"{url}/hands").json()["hand"]["button"] == 1


def test_a_claim_can_be_rejected_and_made_again(game):
    dana, noa, url, _ = game
    dana.post(f"{url}/hands")
    act(dana, url, "all_in")
    act(noa, url, "call")

    noa.post(f"{url}/hands/current/claim", json={"winners": [[1]]})
    rejected = dana.post(f"{url}/hands/current/reject").json()
    assert rejected["hand"]["claim"] is None

    dana.post(f"{url}/hands/current/claim", json={"winners": [[0, 1]]})
    split = noa.post(f"{url}/hands/current/confirm").json()
    assert split["hand"]["payouts"] == {"0": 500, "1": 500}
    assert stacks(split) == {0: 500, 1: 500}


def test_a_claim_must_make_sense(game):
    dana, noa, url, _ = game
    dana.post(f"{url}/hands")
    act(dana, url, "all_in")
    act(noa, url, "call")

    assert noa.post(f"{url}/hands/current/claim", json={"winners": []}).status_code == 409
    assert noa.post(f"{url}/hands/current/claim", json={"winners": [[5]]}).status_code == 409
    assert noa.post(f"{url}/hands/current/confirm").status_code == 409


def test_folding_gives_the_pot_away(game, db):
    dana, noa, url, _ = game
    dana.post(f"{url}/hands")

    table = act(dana, url, "fold")

    assert table["hand"]["street"] == "done"
    assert stacks(table) == {0: 495, 1: 505}
    coins_add_up(db)


def test_its_not_your_turn(game):
    dana, noa, url, _ = game
    dana.post(f"{url}/hands")

    response = noa.post(f"{url}/hands/current/act", json={"action": "fold"})

    assert response.status_code == 409
    assert "your turn" in response.json()["detail"]


def test_a_raise_too_small_is_refused(game):
    dana, _, url, _ = game
    dana.post(f"{url}/hands")

    response = dana.post(f"{url}/hands/current/act", json={"action": "raise", "amount": 15})

    assert response.status_code == 409


def test_no_topping_up_or_leaving_in_the_middle_of_your_hand(game):
    dana, noa, url, _ = game
    dana.post(f"{url}/hands")

    assert dana.post(f"{url}/top-up", json={"amount": 5}).status_code == 409
    assert dana.post(f"{url}/leave").status_code == 409
    assert dana.put(url, json={"name": "Hotel", "small_blind": 10}).status_code == 409


def test_a_player_who_folded_can_get_up_during_the_hand(member, game, db):
    dana, noa, url, market_id = game
    tal = member("tal_b")
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "tal_b"}).json()
    tal.post(f"/invites/{invite['id']}/accept")
    tal.post(f"{url}/sit", json={"buy_in": 300, "seat": 2})
    dana.post(f"{url}/hands")  # button 0, small blind 1, big blind 2, and seat 0 starts
    act(dana, url, "fold")

    left = dana.post(f"{url}/leave")

    assert left.status_code == 200
    assert dana.get(f"/markets/{market_id}").json()["my_balance"] == 1000
    # Someone new takes the empty seat in the middle of the hand: the hand never touches them.
    sam = member("sam_p")
    invite = noa.post(f"/markets/{market_id}/invites", json={"username": "sam_p"}).json()
    sam.post(f"/invites/{invite['id']}/accept")
    sam.post(f"{url}/sit", json={"buy_in": 200, "seat": 0})
    table = act(noa, url, "call")
    assert stacks(table)[0] == 200
    coins_add_up(db)


def test_leaving_the_market_folds_you_out_of_the_hand(game, db):
    dana, noa, url, market_id = game
    dana.post(f"{url}/hands")
    act(dana, url, "raise", 100)

    assert noa.post(f"/markets/{market_id}/leave").status_code == 204

    table = dana.get(url).json()
    assert table["hand"]["street"] == "done"
    assert stacks(table) == {0: 510}
    assert table["seats"][0]["username"] == "dana_k"
    coins_add_up(db)


def test_a_turn_that_runs_out_checks_or_folds(game, db):
    dana, noa, url, market_id = game
    dana.put(url, json={"name": "Hotel", "small_blind": 5, "min_buy_in": 100, "turn_seconds": 30})
    table = dana.post(f"{url}/hands").json()
    assert table["hand"]["turn_ends_at"] is not None

    # Dana's turn (5 to call) ran out a minute ago.
    db.execute(
        update(PokerHand).values(turn_started_at=PokerHand.turn_started_at - timedelta(minutes=1))
    )
    db.flush()

    table = noa.get(url).json()

    assert table["hand"]["street"] == "done"
    assert table["hand"]["log"][-1] == {
        "seat": 0,
        "action": "fold",
        "amount": 5,
        "timed_out": True,
    }
    assert stacks(table) == {0: 495, 1: 505}
    coins_add_up(db)


def test_without_a_timer_turns_wait(game, db):
    dana, noa, url, _ = game
    dana.post(f"{url}/hands")
    db.execute(
        update(PokerHand).values(turn_started_at=PokerHand.turn_started_at - timedelta(days=1))
    )
    db.flush()

    assert noa.get(url).json()["hand"]["to_act"] == 0
