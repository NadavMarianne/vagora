import pytest

from app.config import Settings


@pytest.mark.parametrize(
    "given",
    [
        "postgresql://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/vagora?sslmode=require",
        "postgres://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/vagora?sslmode=require",
    ],
)
def test_host_addresses_get_the_psycopg_driver(given):
    url = Settings(database_url=given).database_url

    assert url == (
        "postgresql+psycopg://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/vagora"
        "?sslmode=require"
    )


def test_addresses_with_a_driver_stay_as_they_are():
    given = "postgresql+psycopg://vagora:vagora@db:5432/vagora"

    assert Settings(database_url=given).database_url == given
