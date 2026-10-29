import pytest

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 1000,
    "time_zone": "Asia/Jerusalem",
}


def create(client, **changes):
    return client.post("/markets", json={**NEW_MARKET, **changes})


def test_creating_a_market_needs_a_profile(login_as):
    response = create(login_as())

    assert response.status_code == 403
    assert response.json()["detail"] == "Set up your profile first."


def test_create_market_gives_starting_amount(member):
    client = member()

    response = create(client)

    assert response.status_code == 201
    market = response.json()
    assert market["name"] == "Home"
    assert market["currency_name"] == "hearts"
    assert market["transfers_enabled"] is False
    assert market["my_balance"] == 1000


def test_starting_amount_is_the_first_ledger_entry(member):
    client = member()
    market_id = create(client).json()["id"]

    entries = client.get(f"/markets/{market_id}/ledger").json()

    assert len(entries) == 1
    assert entries[0]["amount"] == 1000
    assert entries[0]["kind"] == "starting_amount"
    assert entries[0]["note"] == "Starting amount"


def test_zero_starting_amount_adds_no_entry(member):
    client = member()
    market_id = create(client, starting_amount=0).json()["id"]

    assert client.get(f"/markets/{market_id}").json()["my_balance"] == 0
    assert client.get(f"/markets/{market_id}/ledger").json() == []


def test_list_shows_only_my_markets(member):
    dana, noa = member("dana_k"), member("noa_r")
    create(dana, name="Dana's")
    create(noa, name="Noa's")

    names = [market["name"] for market in dana.get("/markets").json()]

    assert names == ["Dana's"]


def test_other_peoples_markets_look_like_they_dont_exist(member):
    dana, noa = member("dana_k"), member("noa_r")
    market_id = create(dana).json()["id"]

    assert noa.get(f"/markets/{market_id}").status_code == 404
    assert noa.get(f"/markets/{market_id}/ledger").status_code == 404
    assert noa.patch(f"/markets/{market_id}", json={"name": "Mine now"}).status_code == 404


@pytest.mark.parametrize(
    "bad",
    [
        {"name": ""},
        {"name": "x" * 51},
        {"currency_name": ""},
        {"starting_amount": -1},
        {"starting_amount": 1.5},
        {"time_zone": "Mars/Olympus"},
    ],
)
def test_bad_settings_are_refused(member, bad):
    assert create(member(), **bad).status_code == 422


def test_change_settings(member):
    client = member()
    market_id = create(client).json()["id"]

    response = client.patch(
        f"/markets/{market_id}",
        json={"currency_name": "stars", "time_zone": "Europe/London", "transfers_enabled": True},
    )

    market = response.json()
    assert response.status_code == 200
    assert market["currency_name"] == "stars"
    assert market["time_zone"] == "Europe/London"
    assert market["transfers_enabled"] is True
    assert market["name"] == "Home"


def test_changing_starting_amount_does_not_change_balances(member):
    client = member()
    market_id = create(client).json()["id"]

    market = client.patch(f"/markets/{market_id}", json={"starting_amount": 50}).json()

    assert market["starting_amount"] == 50
    assert market["my_balance"] == 1000


def test_bad_setting_change_is_refused(member):
    client = member()
    market_id = create(client).json()["id"]

    response = client.patch(f"/markets/{market_id}", json={"time_zone": "Nowhere"})

    assert response.status_code == 422
