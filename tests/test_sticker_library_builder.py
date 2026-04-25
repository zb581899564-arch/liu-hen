from pathlib import Path
import importlib.util


MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "sticker_library_builder.py"
SPEC = importlib.util.spec_from_file_location("sticker_library_builder", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)
build_sticker_library = MODULE.build_sticker_library


def test_build_sticker_library_keeps_only_target_stickers(tmp_path: Path):
    emoji_dir = tmp_path / "emojis"
    emoji_dir.mkdir()
    (emoji_dir / "aaa.gif").write_bytes(b"gif-a")
    (emoji_dir / "bbb.png").write_bytes(b"png-b")

    conversation = {
        "participants": [
            {"id": "me", "role": "user"},
            {"id": "her", "role": "target"},
        ],
        "messages": [
            {
                "role": "target",
                "type": "sticker",
                "assets": [{"md5": "aaa", "path": str(emoji_dir / "aaa.gif")}],
            },
            {
                "role": "target",
                "type": "sticker",
                "assets": [{"md5": "aaa", "path": str(emoji_dir / "aaa.gif")}],
            },
            {
                "role": "user",
                "type": "sticker",
                "assets": [{"md5": "bbb", "path": str(emoji_dir / "bbb.png")}],
            },
        ],
    }

    result = build_sticker_library(conversation)

    assert result["count"] == 1
    assert result["stickers"][0]["md5"] == "aaa"
    assert result["stickers"][0]["count"] == 2
