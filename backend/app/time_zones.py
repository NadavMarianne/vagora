"""The time zones a market can use, for the app's time zone picker.

Comes from the same time zone data the backend uses to check market settings, so every zone
in the list is accepted, and offsets are always current (including daylight saving).
"""

from datetime import UTC, datetime
from functools import cache
from zoneinfo import ZoneInfo, available_timezones

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["time zones"])

# Real places only. Leaves out old aliases like "US/Eastern" and technical ones like "Etc/GMT+3".
REGIONS = {
    "Africa",
    "America",
    "Antarctica",
    "Arctic",
    "Asia",
    "Atlantic",
    "Australia",
    "Europe",
    "Indian",
    "Pacific",
}


class TimeZoneView(BaseModel):
    id: str  # what the market stores, like "Asia/Jerusalem"
    city: str  # "Jerusalem"
    region: str  # "Asia"
    offset: str  # "GMT+2", right now


@cache
def place_zones() -> list[str]:
    return sorted(zone for zone in available_timezones() if zone.split("/")[0] in REGIONS)


def offset_label(zone: str, moment: datetime) -> str:
    minutes = int(moment.astimezone(ZoneInfo(zone)).utcoffset().total_seconds() // 60)
    sign = "+" if minutes >= 0 else "-"
    hours, rest = divmod(abs(minutes), 60)
    return f"GMT{sign}{hours}" + (f":{rest:02d}" if rest else "")


@router.get("/time-zones")
def list_time_zones() -> list[TimeZoneView]:
    """Every place time zone, sorted by city."""
    now = datetime.now(UTC)
    zones = [
        TimeZoneView(
            id=zone,
            city=zone.split("/")[-1].replace("_", " "),
            region=zone.split("/")[0],
            offset=offset_label(zone, now),
        )
        for zone in place_zones()
    ]
    return sorted(zones, key=lambda z: (z.city, z.region))
