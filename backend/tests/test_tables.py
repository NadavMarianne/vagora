import pytest
from sqlalchemy import func, select

from app.models import LedgerEntry, Membership, PokerSeat, User

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 1000,
    "time_zone": "UTC",
}

TABLE = {"name": "Friday game", "small_blind": 5}


@pytest.fixture
def home(member):
    """Dana and Noa in Dana's market, 1000 coins each. Returns (dana, noa, market_id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    return dana, noa, market_id


def open_table(client, market_id, **extra):
    response = client.post(f"/markets/{market_id}/tables", json={**TABLE, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def balance(client, market_id):
    return client.get(f"/markets/{market_id}").json()["my_balance"]


def coins_add_up(db):
    """Every coin is somewhere: balances equal their ledgers, and table stacks equal what was
    taken to tables minus what came back."""
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
    stacks = db.scalar(select(func.sum(PokerSeat.stack)))
    assert -(to_tables or 0) == (stacks or 0)


def test_a_new_table_gets_the_usual_buy_ins(home):
    dana, _, market_id = home

    table = open_table(dana, market_id)

    assert table["big_blind"] == 10
    assert (table["min_buy_in"], table["max_buy_in"]) == (200, 1000)
    assert table["max_players"] == 9
    assert table["turn_seconds"] is None
    assert table["seats"] == []


def test_a_table_can_set_its_own_settings(home):
    dana, _, market_id = home

    table = open_table(
        dana, market_id, max_players=2, min_buy_in=50, max_buy_in=300, turn_seconds=30
    )

    assert (table["max_players"], table["min_buy_in"], table["max_buy_in"]) == (2, 50, 300)
    assert table["turn_seconds"] == 30


@pytest.mark.parametrize(
    "settings",
    [
        {"max_players": 1},
        {"max_players": 10},
        {"min_buy_in": 5},  # below one big blind
        {"min_buy_in": 300, "max_buy_in": 200},
        {"turn_seconds": 1},
    ],
)
def test_impossible_settings_are_refused(home, settings):
    dana, _, market_id = home

    response = dana.post(f"/markets/{market_id}/tables", json={**TABLE, **settings})

    assert response.status_code == 422


def test_sitting_down_moves_the_buy_in_onto_the_table(home, db):
    dana, noa, market_id = home
    table = open_table(dana, market_id)

    seated = noa.post(f"/markets/{market_id}/tables/{table['id']}/sit", json={"buy_in": 300})

    assert seated.status_code == 200
    assert seated.json()["seats"] == [
        {"number": 0, "username": "noa_r", "display_name": "Noa_R", "stack": 300}
    ]
    assert seated.json()["my_seat"] == 0
    assert balance(noa, market_id) == 700
    coins_add_up(db)


@pytest.mark.parametrize("buy_in", [199, 1001])
def test_the_buy_in_must_be_within_the_table_limits(home, buy_in):
    dana, _, market_id = home
    table = open_table(dana, market_id)

    response = dana.post(f"/markets/{market_id}/tables/{table['id']}/sit", json={"buy_in": buy_in})

    assert response.status_code == 409
    assert balance(dana, market_id) == 1000


def test_you_cant_buy_in_with_coins_you_dont_have(home):
    dana, _, market_id = home
    table = open_table(dana, market_id, max_buy_in=5000)

    response = dana.post(f"/markets/{market_id}/tables/{table['id']}/sit", json={"buy_in": 2000})

    assert response.status_code == 409
    assert "enough coins" in response.json()["detail"]


def test_choosing_a_seat_and_a_full_table(home, member):
    dana, noa, market_id = home
    table = open_table(dana, market_id, max_players=2)
    url = f"/markets/{market_id}/tables/{table['id']}"

    assert dana.post(f"{url}/sit", json={"buy_in": 200, "seat": 1}).json()["my_seat"] == 1
    assert noa.post(f"{url}/sit", json={"buy_in": 200, "seat": 1}).status_code == 409
    assert noa.post(f"{url}/sit", json={"buy_in": 200, "seat": 2}).status_code == 409
    assert noa.post(f"{url}/sit", json={"buy_in": 200}).json()["my_seat"] == 0
    assert dana.post(f"{url}/sit", json={"buy_in": 200}).status_code == 409  # already sitting


def test_topping_up_only_fills_to_the_maximum(home, db):
    dana, _, market_id = home
    table = open_table(dana, market_id)
    url = f"/markets/{market_id}/tables/{table['id']}"
    dana.post(f"{url}/sit", json={"buy_in": 800})

    assert dana.post(f"{url}/top-up", json={"amount": 201}).status_code == 409
    topped = dana.post(f"{url}/top-up", json={"amount": 200})

    assert topped.json()["seats"][0]["stack"] == 1000
    assert balance(dana, market_id) == 0
    coins_add_up(db)


def test_a_stack_above_the_maximum_stays_but_cant_top_up(home, db):
    dana, _, market_id = home
    table = open_table(dana, market_id)
    url = f"/markets/{market_id}/tables/{table['id']}"
    dana.post(f"{url}/sit", json={"buy_in": 500})
    # Winnings aren't capped (hands come later): here the stack has grown past the maximum.
    seat = db.scalar(select(PokerSeat))
    seat.stack = 1500
    db.flush()

    response = dana.post(f"{url}/top-up", json={"amount": 1})

    assert response.status_code == 409
    assert dana.get(url).json()["seats"][0]["stack"] == 1500


def test_leaving_brings_the_whole_stack_back(home, db):
    dana, noa, market_id = home
    table = open_table(dana, market_id)
    url = f"/markets/{market_id}/tables/{table['id']}"
    noa.post(f"{url}/sit", json={"buy_in": 300})

    left = noa.post(f"{url}/leave")

    assert left.json()["seats"] == []
    assert left.json()["my_seat"] is None
    assert balance(noa, market_id) == 1000
    assert noa.post(f"{url}/leave").status_code == 409
    coins_add_up(db)


def test_leaving_the_market_gets_you_up_from_its_tables(home, db):
    dana, noa, market_id = home
    table = open_table(dana, market_id)
    noa.post(f"/markets/{market_id}/tables/{table['id']}/sit", json={"buy_in": 300})

    assert noa.post(f"/markets/{market_id}/leave").status_code == 204

    assert dana.get(f"/markets/{market_id}/tables/{table['id']}").json()["seats"] == []
    noa_membership = db.scalar(
        select(Membership).join(Membership.user).where(User.username == "noa_r")
    )
    assert noa_membership.balance == 1000
    coins_add_up(db)


def test_only_the_opener_changes_settings_or_closes(home):
    dana, noa, market_id = home
    table = open_table(dana, market_id)
    url = f"/markets/{market_id}/tables/{table['id']}"

    assert noa.put(url, json={**TABLE, "small_blind": 10}).status_code == 403
    changed = dana.put(url, json={**TABLE, "small_blind": 10})
    assert (changed.json()["big_blind"], changed.json()["min_buy_in"]) == (20, 400)
    assert noa.post(f"{url}/close").status_code == 403


def test_seats_must_still_exist_after_a_change(home):
    dana, noa, market_id = home
    table = open_table(dana, market_id)
    url = f"/markets/{market_id}/tables/{table['id']}"
    noa.post(f"{url}/sit", json={"buy_in": 300, "seat": 5})

    assert dana.put(url, json={**TABLE, "max_players": 4}).status_code == 409


def test_only_an_empty_table_closes(home):
    dana, _, market_id = home
    table = open_table(dana, market_id)
    url = f"/markets/{market_id}/tables/{table['id']}"
    dana.post(f"{url}/sit", json={"buy_in": 300})

    assert dana.post(f"{url}/close").status_code == 409
    dana.post(f"{url}/leave")
    assert dana.post(f"{url}/close").status_code == 204

    assert dana.get(url).status_code == 404
    assert dana.get(f"/markets/{market_id}/tables").json() == []


def test_tables_of_other_markets_stay_hidden(home, member):
    dana, _, market_id = home
    table = open_table(dana, market_id)
    tal = member("tal_b")

    assert tal.get(f"/markets/{market_id}/tables").status_code == 404
    assert (
        tal.post(f"/markets/{market_id}/tables/{table['id']}/sit", json={"buy_in": 300}).status_code
        == 404
    )
