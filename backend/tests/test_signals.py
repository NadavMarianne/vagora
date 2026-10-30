import pytest

from app import signals

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "UTC",
}


@pytest.fixture
def notes(monkeypatch):
    """Records live-update notes instead of sending them: (firebase uid, reason, message)."""
    sent: list[tuple[str, str, str]] = []

    def record(firebase_uids, reason, message=""):
        sent.extend((uid, reason, message) for uid in sorted(set(firebase_uids)))

    monkeypatch.setattr(signals, "notify", record)
    return sent


@pytest.fixture
def home(member):
    """Dana's market. Returns (dana, market_id)."""
    dana = member("dana_k")
    return dana, dana.post("/markets", json=NEW_MARKET).json()["id"]


def invite(client, market_id, username):
    return client.post(f"/markets/{market_id}/invites", json={"username": username}).json()


def test_invited_person_gets_a_banner(notes, member, home):
    dana, market_id = home
    member("noa_r")

    invite(dana, market_id, "noa_r")

    assert ("uid-noa_r", "invite", "Dana_K invited you to Home") in notes
    # The market's members see the new open invite too.
    assert ("uid-dana_k", f"market:{market_id}", "") in notes


def test_cancelling_tells_the_invited_person(notes, member, home):
    dana, market_id = home
    member("noa_r")
    invite_id = invite(dana, market_id, "noa_r")["id"]
    notes.clear()

    dana.delete(f"/markets/{market_id}/invites/{invite_id}")

    assert ("uid-noa_r", "invite", "") in notes


def test_members_hear_who_joined_but_not_the_joiner(notes, member, home):
    dana, market_id = home
    noa = member("noa_r")
    invite_id = invite(dana, market_id, "noa_r")["id"]
    notes.clear()

    noa.post(f"/invites/{invite_id}/accept")

    assert notes == [("uid-dana_k", f"market:{market_id}", "Noa_R joined Home")]


def test_leaving_tells_members_and_uninvites(notes, member, home):
    dana, market_id = home
    member("tal_s")
    noa = member("noa_r")
    noa.post(f"/invites/{invite(dana, market_id, 'noa_r')['id']}/accept")
    invite(noa, market_id, "tal_s")
    notes.clear()

    noa.post(f"/markets/{market_id}/leave")

    assert ("uid-tal_s", "invite", "") in notes
    assert ("uid-dana_k", f"market:{market_id}", "Noa_R left Home") in notes
    assert all(uid != "uid-noa_r" for uid, _, _ in notes)


def test_settings_change_tells_members(notes, home):
    dana, market_id = home

    dana.patch(f"/markets/{market_id}", json={"currency_name": "stars"})

    assert ("uid-dana_k", f"market:{market_id}", "") in notes


def test_without_a_key_notes_are_skipped_quietly():
    # Tests run without FIREBASE_SERVICE_ACCOUNT, like local development.
    signals.notify(["uid-anyone"], "invite", "hello")


def test_a_failing_note_never_breaks_the_action(monkeypatch):
    def broken():
        raise RuntimeError("Firestore is down")

    monkeypatch.setattr(signals, "_client", broken)

    signals.notify(["uid-anyone"], "invite", "hello")
