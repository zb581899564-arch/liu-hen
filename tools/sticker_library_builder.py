import argparse
import json
from pathlib import Path


def build_sticker_library(conversation: dict) -> dict:
    buckets = {}
    for message in conversation.get("messages", []):
        if message.get("role") != "target" or message.get("type") != "sticker":
            continue
        for asset in message.get("assets", []):
            md5 = asset.get("md5")
            if not md5:
                continue
            path = asset.get("path", "")
            ext = Path(path).suffix.lstrip(".").lower() or "unknown"
            current = buckets.setdefault(
                md5,
                {
                    "md5": md5,
                    "path": path,
                    "format": ext,
                    "count": 0,
                },
            )
            current["count"] += 1
    stickers = sorted(buckets.values(), key=lambda item: (-item["count"], item["md5"]))
    return {"count": len(stickers), "stickers": stickers}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--conversation", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    conversation = json.loads(Path(args.conversation).read_text(encoding="utf-8"))
    library = build_sticker_library(conversation)
    Path(args.output).write_text(
        json.dumps(library, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
