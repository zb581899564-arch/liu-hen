import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_sample-contact_profile_ships_sticker_assets_for_runtime_use():
    profile_zip = ROOT / "profiles" / "sample-contact.exprofile.zip"

    with zipfile.ZipFile(profile_zip) as archive:
        names = archive.namelist()
        sticker_entries = [name for name in names if name.startswith("stickers/")]
        sticker_profile = json.loads(archive.read("sticker_profile.json").decode("utf-8"))
        sticker_library = json.loads(archive.read("sticker_library.json").decode("utf-8"))

    assert sticker_entries
    assert sticker_profile["high_frequency_md5"]
    assert sticker_library["stickers"]
