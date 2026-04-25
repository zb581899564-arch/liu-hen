from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


SUPPORTED_TEXT_TYPES = {
    "image": ("image", "pic", "photo", "图片", "照片"),
    "voice": ("voice", "audio", "语音"),
    "video": ("video", "视频"),
    "file": ("file", "document", "文件"),
    "sticker": ("sticker", "sticker", "表情", "贴图", "动画表情"),
}

PLACEHOLDER_PATTERNS = [
    (re.compile(r"^\[(图片|照片|image|photo)\]$", re.IGNORECASE), "image"),
    (re.compile(r"^\[(语音|voice|audio)\]$", re.IGNORECASE), "voice"),
    (re.compile(r"^\[(视频|video)\]$", re.IGNORECASE), "video"),
    (re.compile(r"^\[(文件|file|document)\]$", re.IGNORECASE), "file"),
    (re.compile(r"^\[(表情|贴图|sticker|动画表情)\]$", re.IGNORECASE), "sticker"),
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Normalize WeChat-style exports into the shared conversation schema."
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--file", help="Input file path.")
    input_group.add_argument("--dir", help="Input directory path.")
    parser.add_argument("--target", help="Target speaker name or identifier.", default=None)
    parser.add_argument("--output", help="Output file path. Prints to stdout when omitted.", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    inputs = collect_inputs(args.file, args.dir)
    conversations: list[dict[str, Any]] = []
    for path in inputs:
        conversations.extend(normalize_source(path, args.target))

    payload: Any
    if len(conversations) == 1:
        payload = conversations[0]
    else:
        payload = conversations

    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    else:
        sys.stdout.write(rendered + "\n")
    return 0


def collect_inputs(file_arg: str | None, dir_arg: str | None) -> list[Path]:
    if file_arg:
        path = Path(file_arg)
        if not path.exists():
            raise SystemExit(f"输入文件不存在: {path}")
        if path.is_dir():
            raise SystemExit(f"--file 需要文件路径: {path}")
        return [path]

    directory = Path(dir_arg) if dir_arg else None
    if directory is None or not directory.exists():
        raise SystemExit(f"输入目录不存在: {directory}")
    if not directory.is_dir():
        raise SystemExit(f"--dir 需要目录路径: {directory}")

    files: list[Path] = []
    for child in sorted(directory.rglob("*")):
        if child.is_file() and child.suffix.lower() in {".json", ".txt", ".md", ".html", ".htm"}:
            files.append(child)
    if not files:
        raise SystemExit(f"目录中没有可解析文件: {directory}")
    return files


def normalize_source(path: Path, target: str | None) -> list[dict[str, Any]]:
    raw_text = path.read_text(encoding="utf-8", errors="ignore").lstrip("\ufeff")
    parsed: Any
    if path.suffix.lower() in {".html", ".htm"}:
        parsed = parse_html_fallback(raw_text)
    else:
        parsed = try_load_json(raw_text)
        if parsed is None:
            parsed = raw_text

    if isinstance(parsed, list) and parsed and all(isinstance(item, dict) and is_weflow_export(item) for item in parsed):
        return [normalize_weflow_conversation(item, path, target, index=i + 1) for i, item in enumerate(parsed)]
    if isinstance(parsed, dict) and is_weflow_export(parsed):
        return [normalize_weflow_conversation(parsed, path, target, index=1)]
    if isinstance(parsed, list) and parsed and all(isinstance(item, dict) and has_conversation_shape(item) for item in parsed):
        return [normalize_conversation(item, path, target, index=i + 1) for i, item in enumerate(parsed)]
    if isinstance(parsed, dict) and has_conversation_shape(parsed):
        return [normalize_conversation(parsed, path, target, index=1)]
    if isinstance(parsed, list) and all(isinstance(item, dict) for item in parsed):
        conversation = {
            "conversation_id": derive_conversation_id(path, 1),
            "source": "wechat",
            "messages": parsed,
        }
        return [normalize_conversation(conversation, path, target, index=1)]
    if isinstance(parsed, str):
        conversation = parse_text_export(parsed, path, target)
        return [conversation]

    raise SystemExit(f"无法识别输入格式: {path}")


def has_conversation_shape(value: dict[str, Any]) -> bool:
    return "messages" in value or "participants" in value or "conversation_id" in value


def is_weflow_export(value: dict[str, Any]) -> bool:
    return isinstance(value.get("session"), dict) and isinstance(value.get("messages"), list)


def normalize_conversation(value: dict[str, Any], path: Path, target: str | None, index: int) -> dict[str, Any]:
    messages_raw = extract_message_list(value)
    conversation_id = string_value(value.get("conversation_id")) or derive_conversation_id(path, index)
    source = string_value(value.get("source")) or "wechat"
    normalized_messages = normalize_messages(messages_raw, conversation_id, target)
    participants = normalize_participants(value.get("participants"), normalized_messages, target, conversation_id)
    if len(participants) < 2:
        participants = add_synthetic_participant(participants, target, conversation_id)
    return {
        "conversation_id": conversation_id,
        "source": source,
        "participants": participants,
        "messages": normalized_messages,
    }


def normalize_weflow_conversation(value: dict[str, Any], path: Path, target: str | None, index: int) -> dict[str, Any]:
    session = value.get("session") if isinstance(value.get("session"), dict) else {}
    conversation_id = string_value(session.get("wxid")) or derive_conversation_id(path, index)
    session_wxid = string_value(session.get("wxid"))
    target_name = (
        target
        or first_string(session, ("displayName", "nickname", "remark", "wxid"))
        or "target"
    )
    resource_root = path.parent.parent if path.parent.name == "texts" else path.parent

    normalized_messages: list[dict[str, Any]] = []
    self_participant: dict[str, str] | None = None
    target_participant = {
        "id": session_wxid or slugify(target_name),
        "role": "target",
        "name": target_name,
    }

    for index_value, raw in enumerate(extract_message_list(value), start=1):
        message = normalize_weflow_message(
            raw=raw,
            conversation_id=conversation_id,
            index=index_value,
            target=target_name,
            session= session,
            resource_root=resource_root,
        )
        normalized_messages.append(message)
        if message["role"] == "user" and self_participant is None:
            self_participant = {
                "id": message["speaker_id"],
                "role": "user",
                "name": first_string(raw, ("senderDisplayName", "senderUsername")) or message["speaker_id"],
            }

    participants: list[dict[str, str]] = []
    if self_participant is not None:
        participants.append(self_participant)
    participants.append(target_participant)
    participants = dedupe_participants(participants)
    if len(participants) < 2:
        participants = add_synthetic_participant(participants, target_name, conversation_id)

    return {
        "conversation_id": conversation_id,
        "source": "wechat",
        "participants": participants,
        "messages": normalized_messages,
    }


def normalize_weflow_message(
    raw: dict[str, Any],
    conversation_id: str,
    index: int,
    target: str,
    session: dict[str, Any],
    resource_root: Path,
) -> dict[str, Any]:
    speaker_name = first_string(raw, ("senderDisplayName", "senderUsername")) or "speaker"
    speaker_id = first_string(raw, ("senderUsername", "senderAvatarKey", "senderDisplayName")) or slugify(speaker_name)
    role = infer_weflow_role(raw, speaker_name, speaker_id, target, session)
    message_type = infer_weflow_message_type(raw)
    content = raw.get("content")
    reply_to = first_string(raw, ("replyToMessageId", "reply_to", "replyTo"))
    tags = []
    if message_type == "text" and string_value(raw.get("type")) == "引用消息":
        tags.append("quote")

    return {
        "id": first_string(raw, ("platformMessageId", "id", "message_id", "msg_id", "localId")) or f"{conversation_id}:{index:06d}",
        "time": first_string(raw, ("formattedTime", "createTime", "time", "timestamp")),
        "speaker_id": speaker_id,
        "role": role,
        "type": message_type,
        "content": string_or_null(content),
        "reply_to": string_or_null(reply_to),
        "assets": normalize_weflow_assets(raw, message_type, resource_root, session),
        "tags": tags,
    }


def infer_weflow_role(
    raw: dict[str, Any],
    speaker_name: str,
    speaker_id: str,
    target: str,
    session: dict[str, Any],
) -> str:
    is_send = raw.get("isSend")
    if is_send in {1, True, "1"}:
        return "user"
    session_wxid = string_value(session.get("wxid"))
    if session_wxid and same_label(speaker_id, session_wxid):
        return "target"
    if target and (same_label(speaker_name, target) or same_label(speaker_id, target)):
        return "target"
    return "user"


def infer_weflow_message_type(raw: dict[str, Any]) -> str:
    explicit = string_value(raw.get("type"))
    mapping = {
        "文本消息": "text",
        "动画表情": "sticker",
        "图片消息": "image",
        "语音消息": "voice",
        "视频消息": "video",
        "位置消息": "file",
        "系统消息": "system",
        "引用消息": "text",
    }
    if explicit in mapping:
        return mapping[explicit]
    return infer_message_type(raw)


def normalize_weflow_assets(
    raw: dict[str, Any], message_type: str, resource_root: Path, session: dict[str, Any]
) -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []

    if message_type == "sticker":
        emoji_md5 = first_string(raw, ("emojiMd5",))
        sticker_path = find_weflow_emoji_path(resource_root, emoji_md5)
        if sticker_path or emoji_md5:
            asset = {
                "kind": "sticker",
                "path": sticker_path or first_string(raw, ("emojiCdnUrl", "content")),
            }
            if emoji_md5:
                asset["sticker_id"] = emoji_md5
                asset["md5"] = emoji_md5
            assets.append(asset)
            return assets

    if message_type == "image":
        image_path = find_weflow_local_match(resource_root / "images", f"{raw.get('localId')}_*")
        if image_path:
            assets.append({"kind": "image", "path": image_path})
            return assets

    if message_type == "voice":
        session_wxid = string_value(session.get("wxid"))
        voice_path = find_weflow_local_match(
            resource_root / "voices", f"voice_{session_wxid}_{raw.get('localId')}_*"
        )
        if voice_path:
            assets.append({"kind": "voice", "path": voice_path})
            return assets

    return normalize_assets(raw, message_type, raw.get("content"))


def find_weflow_emoji_path(resource_root: Path, emoji_md5: str) -> str:
    if not emoji_md5:
        return ""
    emoji_dir = resource_root / "emojis"
    for candidate in sorted(emoji_dir.glob(f"{emoji_md5}.*")):
        if candidate.is_file():
            return str(candidate)
    return ""


def find_weflow_local_match(directory: Path, pattern: str) -> str:
    if not directory.exists():
        return ""
    for candidate in sorted(directory.glob(pattern)):
        if candidate.is_file():
            return str(candidate)
    return ""


def dedupe_participants(participants: list[dict[str, str]]) -> list[dict[str, str]]:
    unique: list[dict[str, str]] = []
    seen: set[str] = set()
    for participant in participants:
        pid = participant["id"]
        if pid in seen:
            continue
        seen.add(pid)
        unique.append(participant)
    return unique


def extract_message_list(value: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("messages", "data", "items", "records", "conversation"):
        candidate = value.get(key)
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]
        if isinstance(candidate, dict) and isinstance(candidate.get("messages"), list):
            return [item for item in candidate["messages"] if isinstance(item, dict)]
    return []


def normalize_messages(messages: list[dict[str, Any]], conversation_id: str, target: str | None) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    previous_sender = ""
    previous_time = ""
    for index, raw in enumerate(messages, start=1):
        message = normalize_message(raw, conversation_id, index, target, previous_sender, previous_time)
        previous_sender = message["speaker_id"]
        previous_time = message["time"]
        normalized.append(message)
    return normalized


def normalize_message(
    raw: dict[str, Any],
    conversation_id: str,
    index: int,
    target: str | None,
    previous_sender: str,
    previous_time: str,
) -> dict[str, Any]:
    time_value = first_string(raw, ("time", "timestamp", "date", "created_at", "createdAt", "sent_at", "sentAt"))
    if not time_value and previous_time:
        time_value = previous_time

    speaker_name = first_string(raw, ("speaker", "sender", "author", "name", "from", "username", "display_name"))
    speaker_id = first_string(raw, ("speaker_id", "participant_id", "sender_id", "author_id", "from_id"))
    if not speaker_id:
        speaker_id = slugify(speaker_name or previous_sender or "speaker")
    if not speaker_name:
        speaker_name = speaker_id

    role = infer_role(speaker_name, speaker_id, target, raw)
    message_type = infer_message_type(raw)
    content = raw.get("content")
    if content is None and isinstance(raw.get("text"), str):
        content = raw["text"]
    if message_type != "text" and content is None:
        content = placeholder_content(raw)

    assets = normalize_assets(raw, message_type, content)
    if not message_type:
        message_type = infer_message_type_from_assets(assets, content)
    if not message_type:
        message_type = "text"

    reply_to = raw.get("reply_to")
    if reply_to is None:
        reply_to = raw.get("replyTo")

    tags = raw.get("tags")
    if not isinstance(tags, list):
        tags = []
    tags = [str(tag) for tag in tags if tag is not None]

    message_id = first_string(raw, ("id", "message_id", "msg_id"))
    if not message_id:
        message_id = f"{conversation_id}:{index:06d}"

    return {
        "id": message_id,
        "time": string_value(time_value),
        "speaker_id": speaker_id,
        "role": role,
        "type": message_type,
        "content": string_or_null(content),
        "reply_to": string_or_null(reply_to),
        "assets": assets,
        "tags": tags,
    }


def normalize_participants(
    raw_participants: Any,
    messages: list[dict[str, Any]],
    target: str | None,
    conversation_id: str,
) -> list[dict[str, Any]]:
    participants: list[dict[str, Any]] = []
    seen: set[str] = set()

    if isinstance(raw_participants, list):
        for item in raw_participants:
            if not isinstance(item, dict):
                continue
            name = first_string(item, ("name", "display_name", "alias", "nickname", "id")) or "participant"
            pid = first_string(item, ("id", "participant_id", "speaker_id")) or slugify(name)
            role = item.get("role")
            role = role if role in {"user", "target"} else infer_role(name, pid, target, item)
            if pid in seen:
                continue
            seen.add(pid)
            participants.append({"id": pid, "role": role, "name": name})

    if not participants:
        for message in messages:
            pid = message["speaker_id"]
            if pid in seen:
                continue
            seen.add(pid)
            participants.append({"id": pid, "role": message["role"], "name": pid})

    if target:
        matched = False
        for participant in participants:
            if same_label(participant["id"], target) or same_label(participant["name"], target):
                participant["role"] = "target"
                matched = True
            elif participant["role"] != "target":
                participant["role"] = "user"
        if not matched:
            target_id = slugify(target)
            if target_id not in seen:
                participants.append({"id": target_id, "role": "target", "name": target})
    else:
        for participant in participants:
            participant["role"] = participant["role"] if participant["role"] in {"user", "target"} else "user"

    unique: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for participant in participants:
        pid = participant["id"]
        if pid in seen_ids:
            continue
        seen_ids.add(pid)
        unique.append(
            {
                "id": pid,
                "role": participant["role"] if participant["role"] in {"user", "target"} else "user",
                "name": participant["name"],
            }
        )
    return unique


def add_synthetic_participant(
    participants: list[dict[str, Any]], target: str | None, conversation_id: str
) -> list[dict[str, Any]]:
    if len(participants) >= 2:
        return participants
    if participants and participants[0]["role"] == "target":
        synthetic = {"id": f"{conversation_id}-user", "role": "user", "name": "user"}
    else:
        synthetic_name = target or "target"
        synthetic = {"id": f"{slugify(synthetic_name)}-target", "role": "target", "name": synthetic_name}
    existing_ids = {item["id"] for item in participants}
    if synthetic["id"] in existing_ids:
        synthetic["id"] = f"{synthetic['id']}-{len(participants) + 1}"
    return participants + [synthetic]


def infer_role(name: str, speaker_id: str, target: str | None, raw: dict[str, Any]) -> str:
    if raw.get("from_me") is True or raw.get("is_self") is True:
        return "user"
    if isinstance(raw.get("me"), bool) and raw.get("me") is True:
        return "user"
    if target and (same_label(name, target) or same_label(speaker_id, target)):
        return "target"
    return "user"


def infer_message_type(raw: dict[str, Any]) -> str:
    explicit = first_string(raw, ("type", "message_type", "msg_type", "kind"))
    if explicit:
        lowered = explicit.lower()
        if lowered in {"text", "sticker", "image", "voice", "video", "file", "system"}:
            return lowered
    if raw.get("is_sticker") is True or raw.get("sticker_id") or raw.get("sticker"):
        return "sticker"
    if raw.get("image") or raw.get("image_path") or raw.get("photo") or raw.get("photo_path"):
        return "image"
    if raw.get("voice") or raw.get("voice_path") or raw.get("audio") or raw.get("audio_path"):
        return "voice"
    if raw.get("video") or raw.get("video_path"):
        return "video"
    if raw.get("file") or raw.get("file_path") or raw.get("document"):
        return "file"
    content = raw.get("content")
    if isinstance(content, str):
        placeholder_type = detect_placeholder_type(content)
        if placeholder_type:
            return placeholder_type
    return "text"


def infer_message_type_from_assets(assets: list[dict[str, Any]], content: Any) -> str:
    if assets:
        kinds = {string_value(asset.get("kind")).lower() for asset in assets}
        for kind in ("sticker", "image", "voice", "video", "file", "system"):
            if kind in kinds:
                return kind
    if isinstance(content, str):
        placeholder_type = detect_placeholder_type(content)
        if placeholder_type:
            return placeholder_type
    return "text"


def normalize_assets(raw: dict[str, Any], message_type: str, content: Any) -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []
    candidate_assets = raw.get("assets")
    if isinstance(candidate_assets, list):
        for asset in candidate_assets:
            if not isinstance(asset, dict):
                continue
            kind = string_value(asset.get("kind")) or message_type
            path = string_value(asset.get("path")) or string_value(asset.get("url")) or string_value(asset.get("uri"))
            if not path:
                path = string_value(content) if isinstance(content, str) else ""
            if not path:
                continue
            normalized_asset = {"kind": kind or "file", "path": path}
            for extra_key in ("desc", "sticker_id", "pack", "md5"):
                extra_value = asset.get(extra_key)
                if extra_value is not None and extra_value != "":
                    normalized_asset[extra_key] = string_value(extra_value)
            assets.append(normalized_asset)

    if assets:
        return assets

    for field, kind in (
        ("sticker_id", "sticker"),
        ("image_path", "image"),
        ("photo_path", "image"),
        ("voice_path", "voice"),
        ("audio_path", "voice"),
        ("video_path", "video"),
        ("file_path", "file"),
    ):
        value = raw.get(field)
        if value:
            assets.append({"kind": kind, "path": string_value(value)})

    if assets:
        return assets

    if isinstance(content, str):
        placeholder_type = detect_placeholder_type(content)
        if placeholder_type:
            assets.append({"kind": placeholder_type, "path": content})

    return assets


def placeholder_content(raw: dict[str, Any]) -> str | None:
    for key in ("placeholder", "text", "content"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def parse_text_export(text: str, path: Path, target: str | None) -> dict[str, Any]:
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    messages: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for index, line in enumerate(lines, start=1):
        match = re.match(r"^(?P<time>.+?)\s+(?P<sender>[^:：]+)[:：]\s*(?P<content>.*)$", line)
        if match:
            if current is not None:
                messages.append(current)
            current = {
                "time": match.group("time").strip(),
                "sender": match.group("sender").strip(),
                "content": match.group("content").strip(),
                "id": f"{derive_conversation_id(path, 1)}:{len(messages) + 1:06d}",
            }
            continue
        if current is None:
            current = {
                "time": "",
                "sender": target or "speaker",
                "content": line.strip(),
                "id": f"{derive_conversation_id(path, 1)}:{len(messages) + 1:06d}",
            }
        else:
            current["content"] = f"{current['content']}\n{line.strip()}".strip()
    if current is not None:
        messages.append(current)

    conversation_id = derive_conversation_id(path, 1)
    normalized_messages: list[dict[str, Any]] = []
    for index, raw in enumerate(messages, start=1):
        sender = raw.get("sender", "")
        content = raw.get("content", "")
        message_type = detect_placeholder_type(content) or "text"
        normalized_messages.append(
            {
                "id": raw.get("id") or f"{conversation_id}:{index:06d}",
                "time": string_value(raw.get("time")),
                "speaker_id": slugify(sender or "speaker"),
                "role": infer_role(sender, slugify(sender or "speaker"), target, raw),
                "type": message_type,
                "content": content if message_type == "text" else content,
                "reply_to": None,
                "assets": [{"kind": message_type, "path": content}] if message_type != "text" and content else [],
                "tags": [],
            }
        )

    participants = normalize_participants(
        [{"id": slugify(item.get("sender", "")), "name": item.get("sender", ""), "role": infer_role(item.get("sender", ""), slugify(item.get("sender", "")), target, item)} for item in messages],
        normalized_messages,
        target,
        conversation_id,
    )
    if len(participants) < 2:
        participants = add_synthetic_participant(participants, target, conversation_id)

    return {
        "conversation_id": conversation_id,
        "source": "wechat",
        "participants": participants,
        "messages": normalized_messages,
    }


def parse_html_fallback(text: str) -> Any:
    cleaned = re.sub(r"(?is)<(script|style).*?>.*?</\\1>", "", text)
    cleaned = re.sub(r"(?is)<br\\s*/?>", "\n", cleaned)
    cleaned = re.sub(r"(?is)</p\\s*>", "\n", cleaned)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    stripped = cleaned.strip()
    return stripped


def try_load_json(text: str) -> Any | None:
    stripped = text.lstrip("\ufeff").strip()
    if not stripped:
        return None
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return None


def derive_conversation_id(path: Path, index: int) -> str:
    base = slugify(path.stem or path.name)
    digest = hashlib.sha1(str(path.resolve()).encode("utf-8", errors="ignore")).hexdigest()[:8]
    return f"{base}-{index}-{digest}" if base else f"conversation-{index}-{digest}"


def detect_placeholder_type(content: str) -> str | None:
    value = content.strip()
    for pattern, kind in PLACEHOLDER_PATTERNS:
        if pattern.match(value):
            return kind
    lowered = value.lower()
    for kind, labels in SUPPORTED_TEXT_TYPES.items():
        if any(label and label in lowered for label in labels):
            if len(lowered) <= 24 or lowered.startswith("["):
                return kind
    return None


def same_label(left: str | None, right: str | None) -> bool:
    return normalize_label(left) == normalize_label(right)


def normalize_label(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"[^0-9a-z]+", "", str(value).casefold())


def first_string(raw: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is not None and not isinstance(value, (dict, list)):
            text = str(value).strip()
            if text:
                return text
    return ""


def string_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def string_or_null(value: Any) -> str | None:
    text = string_value(value).strip()
    return text or None


def slugify(value: str) -> str:
    lowered = re.sub(r"[^0-9A-Za-z._-]+", "-", value.strip()).strip("-_.")
    if lowered:
        return lowered
    digest = hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:12]
    return f"id-{digest}"


if __name__ == "__main__":
    raise SystemExit(main())
