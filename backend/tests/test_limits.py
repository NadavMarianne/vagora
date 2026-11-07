import pytest
from sqlalchemy import select

from app.models import LimitItem

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "UTC",
    "limits_edit_price": 30,
}


@pytest.fixture
def home(member):
    """Dana and Noa in Dana's market, where an edit costs 30. Returns (dana, noa, market_id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    return dana, noa, market_id


def save(client, market_id, *lines):
    return client.put(f"/markets/{market_id}/limits", json={"lines": list(lines)})


def balance(client, market_id):
    return client.get(f"/markets/{market_id}").json()["my_balance"]


def test_new_members_set_limits_first(home):
    _, noa, market_id = home

    assert noa.get(f"/markets/{market_id}").json()["my_limits_set"] is False
    page = save(noa, market_id, "No heights", "No spicy food").json()

    assert page["limits"] == ["No heights", "No spicy food"]
    assert page["limits_set"] is True
    assert noa.get(f"/markets/{market_id}").json()["my_limits_set"] is True


def test_setting_nothing_counts(home):
    _, noa, market_id = home

    page = save(noa, market_id).json()

    assert page["limits"] == []
    assert page["limits_set"] is True


def test_everyone_sees_them(home):
    dana, noa, market_id = home
    save(noa, market_id, "No heights")

    seen = dana.get(f"/markets/{market_id}/members/noa_r").json()

    assert seen["limits"] == ["No heights"]
    assert seen["is_me"] is False
    assert seen["next_edit_cost"] is None  # only on your own page


def test_setup_and_first_edit_are_free_then_edits_cost(home):
    _, noa, market_id = home
    save(noa, market_id, "No heights")  # setup
    assert save(noa, market_id, "No heights", "No snakes").json()["next_edit_cost"] == 30
    assert balance(noa, market_id) == 100  # the first edit was free

    page = save(noa, market_id, "No heights", "No snakes", "No spiders", "No cold").json()

    # One paid edit, however many lines it adds.
    assert balance(noa, market_id) == 70
    assert page["limits"] == ["No heights", "No snakes", "No spiders", "No cold"]


def test_a_paid_edit_can_change_anything(home):
    _, noa, market_id = home
    save(noa, market_id, "No heights")
    save(noa, market_id, "No heights", "No snakes")

    page = save(noa, market_id, "No tall places", "No spiders").json()

    assert page["limits"] == ["No tall places", "No spiders"]
    assert balance(noa, market_id) == 70


def test_removing_is_free(home):
    _, noa, market_id = home
    save(noa, market_id, "No heights", "No snakes")
    save(noa, market_id, "No heights", "No snakes", "No spiders")  # the free edit

    save(noa, market_id, "No snakes")

    assert balance(noa, market_id) == 100


def test_no_debt(home):
    dana, noa, market_id = home
    dana.patch(f"/markets/{market_id}", json={"limits_edit_price": 500})
    save(noa, market_id, "No heights")
    save(noa, market_id, "No heights", "No snakes")

    response = save(noa, market_id, "No heights", "No snakes", "No spiders")

    assert response.status_code == 409
    assert noa.get(f"/markets/{market_id}/members/noa_r").json()["limits"] == [
        "No heights",
        "No snakes",
    ]


def test_history_is_kept(home, db):
    _, noa, market_id = home
    save(noa, market_id, "No heights")
    save(noa, market_id, "No tall places")

    items = db.scalars(select(LimitItem).order_by(LimitItem.id)).all()

    assert [(i.text, i.removed_at is not None) for i in items] == [
        ("No heights", True),
        ("No tall places", False),
    ]


def test_lines_are_short(home):
    _, noa, market_id = home

    assert save(noa, market_id, "x" * 101).status_code == 422
    assert save(noa, market_id, " ", "No heights", "No heights").json()["limits"] == ["No heights"]


def test_market_creator_sets_them_too(home):
    dana, _, market_id = home

    assert dana.get(f"/markets/{market_id}").json()["my_limits_set"] is False


def test_only_members_have_pages(home, member):
    dana, _, market_id = home
    member("stranger")

    assert dana.get(f"/markets/{market_id}/members/stranger").status_code == 404
