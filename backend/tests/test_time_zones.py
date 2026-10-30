from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.main import app
from app.markets import known_time_zone
from app.time_zones import offset_label

client = TestClient(app)


def test_lists_places_with_offsets():
    zones = {z["id"]: z for z in client.get("/time-zones").json()}

    assert zones["Asia/Jerusalem"]["city"] == "Jerusalem"
    assert zones["Asia/Jerusalem"]["region"] == "Asia"
    assert zones["Asia/Jerusalem"]["offset"] in ("GMT+2", "GMT+3")
    assert zones["America/Argentina/Buenos_Aires"]["city"] == "Buenos Aires"


def test_leaves_out_aliases_and_technical_zones():
    ids = {z["id"] for z in client.get("/time-zones").json()}

    assert "US/Eastern" not in ids
    assert "Etc/GMT+3" not in ids
    assert "UTC" not in ids


def test_every_listed_zone_is_accepted_by_market_settings():
    for zone in client.get("/time-zones").json():
        assert known_time_zone(zone["id"]) == zone["id"]


def test_offset_labels():
    winter = datetime(2026, 1, 15, tzinfo=UTC)
    summer = datetime(2026, 7, 15, tzinfo=UTC)

    assert offset_label("Asia/Jerusalem", winter) == "GMT+2"
    assert offset_label("Asia/Jerusalem", summer) == "GMT+3"
    assert offset_label("Europe/London", winter) == "GMT+0"
    assert offset_label("America/New_York", winter) == "GMT-5"
    assert offset_label("Asia/Kolkata", winter) == "GMT+5:30"
