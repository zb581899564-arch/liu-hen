import json
from pathlib import Path


def load_schema(name: str) -> dict:
    schema_path = Path(__file__).resolve().parents[1] / "schema" / name
    return json.loads(schema_path.read_text(encoding="utf-8"))


def test_conversation_schema_has_dual_role_fields():
    schema = load_schema("conversation.schema.json")

    assert schema["required"] == ["conversation_id", "source", "participants", "messages"]

    participant_schema = schema["properties"]["participants"]["items"]
    assert participant_schema["properties"]["role"]["enum"] == ["user", "target"]

    message_schema = schema["properties"]["messages"]["items"]
    assert message_schema["required"] == [
        "id",
        "time",
        "speaker_id",
        "role",
        "type",
        "assets",
        "tags",
    ]
    assert message_schema["properties"]["role"]["enum"] == ["user", "target"]
    assert message_schema["properties"]["type"]["enum"] == [
        "text",
        "sticker",
        "image",
        "voice",
        "video",
        "file",
        "system",
    ]

    asset_schema = message_schema["properties"]["assets"]["items"]
    assert asset_schema["required"] == ["kind", "path"]
    assert set(asset_schema["properties"]) >= {
        "kind",
        "path",
        "desc",
        "sticker_id",
        "pack",
        "md5",
    }

    sample_conversation = {
        "conversation_id": "conv_001",
        "source": "wechat_export",
        "participants": [
            {"id": "p_user", "role": "user", "name": "User"},
            {"id": "p_target", "role": "target", "name": "Target"},
        ],
        "messages": [
            {
                "id": "msg_001",
                "time": "2026-04-19T09:00:00+08:00",
                "speaker_id": "p_user",
                "role": "user",
                "type": "text",
                "assets": [],
                "tags": ["greeting"],
            },
            {
                "id": "msg_002",
                "time": "2026-04-19T09:01:00+08:00",
                "speaker_id": "p_target",
                "role": "target",
                "type": "sticker",
                "assets": [
                    {
                        "kind": "sticker",
                        "path": "assets/stickers/smirk_cat.webp",
                        "desc": "smirk cat",
                        "sticker_id": "smirk_cat",
                        "pack": "cats",
                        "md5": "0123456789abcdef0123456789abcdef",
                    }
                ],
                "tags": ["playful"],
            },
        ],
    }

    assert {participant["role"] for participant in sample_conversation["participants"]} == {
        "user",
        "target",
    }
    assert {message["role"] for message in sample_conversation["messages"]} == {"user", "target"}
    assert sample_conversation["messages"][1]["assets"][0]["sticker_id"] == "smirk_cat"


def test_distillation_output_schema_has_expected_artifacts():
    schema = load_schema("distillation-output.schema.json")

    assert schema["required"] == [
        "persona",
        "relationship_context",
        "response_patterns",
        "memories",
        "sticker_profile",
        "meta",
    ]
    assert schema["properties"]["persona"]["type"] == "string"
    assert schema["properties"]["relationship_context"]["type"] == "string"
    assert schema["properties"]["response_patterns"]["type"] == "string"
    assert schema["properties"]["memories"]["type"] == "string"
    assert schema["properties"]["sticker_profile"]["type"] == "object"
    assert schema["properties"]["meta"]["type"] == "object"
