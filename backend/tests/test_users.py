import pytest
from fastapi.testclient import TestClient

from app.main import app


def set_up(client, username="dana_k", display_name="Dana"):
    return client.post("/me", json={"username": username, "display_name": display_name})


def test_me_needs_login():
    assert TestClient(app).get("/me").status_code == 401


def test_new_login_has_no_profile_yet(login_as):
    response = login_as().get("/me")

    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not set up yet."


def test_profile_setup_then_me(login_as):
    client = login_as()

    created = set_up(client, display_name="Dana 💛")
    me = client.get("/me")

    assert created.status_code == 201
    assert me.status_code == 200
    assert me.json() == {"username": "dana_k", "display_name": "Dana 💛"}


def test_profile_can_only_be_set_up_once(login_as):
    client = login_as()
    set_up(client)

    response = set_up(client, username="another_name")

    assert response.status_code == 409
    assert response.json()["detail"] == "Profile already set up."


def test_username_is_stored_in_lowercase(login_as):
    response = set_up(login_as(), username="Dana_K")

    assert response.json()["username"] == "dana_k"


def test_username_taken_ignores_case(login_as):
    set_up(login_as(uid="uid-dana"), username="dana_k")

    response = set_up(login_as(uid="uid-noa"), username="DANA_K")

    assert response.status_code == 409
    assert response.json()["detail"] == "Username is taken."


@pytest.mark.parametrize(
    "username",
    ["ab", "a" * 21, "has space", "dash-name", "émoji", "dana!"],
)
def test_bad_usernames_are_refused(login_as, username):
    assert set_up(login_as(), username=username).status_code == 422


@pytest.mark.parametrize("display_name", ["", "   ", "x" * 31])
def test_bad_display_names_are_refused(login_as, display_name):
    assert set_up(login_as(), display_name=display_name).status_code == 422


def test_display_name_allows_hebrew_and_is_trimmed(login_as):
    response = set_up(login_as(), display_name="  נדב  ")

    assert response.json()["display_name"] == "נדב"


def test_display_names_do_not_have_to_be_unique(login_as):
    set_up(login_as(uid="uid-dana"), username="dana_k", display_name="Sam")

    response = set_up(login_as(uid="uid-noa"), username="noa_r", display_name="Sam")

    assert response.status_code == 201
