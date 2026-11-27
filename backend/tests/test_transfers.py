import pytest

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "UTC",
    "transfers_enabled": True,
}


@pytest.fixture
def home(member):
    """Dana and Noa in a market where sending is on, 100 coins each. Returns (dana, noa, id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    return dana, noa, market_id


def balance(client, market_id):
    return client.get(f"/markets/{market_id}").json()["my_balance"]


def history(client, market_id):
    entries = client.get(f"/markets/{market_id}/ledger").json()
    return [(e["amount"], e["kind"], e["note"]) for e in entries]


def test_coins_move_from_one_to_the_other(home):
    dana, noa, market_id = home

    response = dana.post(
        f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 30, "note": "Happy birthday"}
    )

    assert response.status_code == 200
    assert response.json() == {"my_balance": 70}
    assert balance(noa, market_id) == 130
    assert history(dana, market_id)[0] == (-30, "sent", "To Noa_R: Happy birthday")
    assert history(noa, market_id)[0] == (30, "received", "From Dana_K: Happy birthday")


def test_the_note_is_optional(home):
    dana, noa, market_id = home

    dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 5})

    assert history(noa, market_id)[0] == (5, "received", "From Dana_K")


def test_the_receiver_is_told(home):
    dana, noa, market_id = home

    dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 5, "note": "For you"})

    news = noa.get("/notifications").json()[0]
    assert news["message"] == "Dana_K sent you 5 hearts: For you"
    assert news["level"] == "good"


def test_not_more_than_you_have(home):
    dana, noa, market_id = home

    response = dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 101})

    assert response.status_code == 409
    assert balance(dana, market_id) == 100
    assert balance(noa, market_id) == 100


def test_everything_you_have(home):
    dana, _, market_id = home

    response = dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 100})

    assert response.json() == {"my_balance": 0}


def test_only_when_the_market_allows_it(home):
    dana, _, market_id = home
    dana.patch(f"/markets/{market_id}", json={"transfers_enabled": False})

    response = dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 5})

    assert response.status_code == 403


def test_not_to_yourself(home):
    dana, _, market_id = home

    response = dana.post(f"/markets/{market_id}/send", json={"to": "dana_k", "amount": 5})

    assert response.status_code == 400


def test_only_to_people_in_the_market(home, member):
    dana, _, market_id = home
    member("bo_x")

    response = dana.post(f"/markets/{market_id}/send", json={"to": "bo_x", "amount": 5})

    assert response.status_code == 404


@pytest.mark.parametrize("amount", [0, -5])
def test_only_positive_amounts(home, amount):
    dana, _, market_id = home

    response = dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": amount})

    assert response.status_code == 422


def test_a_long_note_is_cut_to_fit(home):
    dana, noa, market_id = home

    dana.post(f"/markets/{market_id}/send", json={"to": "noa_r", "amount": 5, "note": "x" * 100})

    note = history(noa, market_id)[0][2]
    assert len(note) == 100
    assert note.endswith("…")
