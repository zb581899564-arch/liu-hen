import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PARSER_PATH = ROOT / "tools" / "wechat_parser.py"


def load_parser_module():
    spec = importlib.util.spec_from_file_location("wechat_parser", PARSER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_normalize_weflow_export_preserves_roles_and_local_assets(tmp_path):
    parser = load_parser_module()

    root = tmp_path / "聊天记录"
    texts_dir = root / "texts"
    emojis_dir = root / "emojis"
    images_dir = root / "images"
    voices_dir = root / "voices"
    texts_dir.mkdir(parents=True)
    emojis_dir.mkdir()
    images_dir.mkdir()
    voices_dir.mkdir()

    (emojis_dir / "572c031ccfb0efaf792a8ae07ae31708.gif").write_bytes(b"gif")
    (images_dir / "242_example.png").write_bytes(b"png")
    (voices_dir / "voice_wxid_8gihiybgo4vc22_7256_demo.wav").write_bytes(b"wav")

    payload = {
        "weflow": {"version": "1.0.3"},
        "session": {
            "wxid": "wxid_8gihiybgo4vc22",
            "nickname": "Sample Contact",
            "displayName": "Sample Contact",
            "type": "私聊",
        },
        "messages": [
            {
                "localId": 2,
                "createTime": 1774022461,
                "formattedTime": "2026-03-21 00:01:01",
                "type": "文本消息",
                "localType": 1,
                "content": "大了就好了",
                "isSend": 1,
                "senderUsername": "wxid_xwhr0t06uph222",
                "senderDisplayName": "开始之前",
                "platformMessageId": "8941163891350392838",
            },
            {
                "localId": 5,
                "createTime": 1774022686,
                "formattedTime": "2026-03-21 00:04:46",
                "type": "文本消息",
                "localType": 1,
                "content": "不知道诶",
                "isSend": 0,
                "senderUsername": "wxid_8gihiybgo4vc22",
                "senderDisplayName": "Sample Contact",
                "platformMessageId": "1889718664619523184",
            },
            {
                "localId": 7,
                "createTime": 1774022692,
                "formattedTime": "2026-03-21 00:04:52",
                "type": "动画表情",
                "localType": 47,
                "content": "[表情包]",
                "isSend": 0,
                "senderUsername": "wxid_8gihiybgo4vc22",
                "senderDisplayName": "Sample Contact",
                "emojiMd5": "572c031ccfb0efaf792a8ae07ae31708",
                "platformMessageId": "5366124858768412427",
            },
            {
                "localId": 242,
                "createTime": 1774061143,
                "formattedTime": "2026-03-21 10:45:43",
                "type": "图片消息",
                "localType": 3,
                "content": "[图片]",
                "isSend": 0,
                "senderUsername": "wxid_8gihiybgo4vc22",
                "senderDisplayName": "Sample Contact",
                "platformMessageId": "7153093863782308975",
            },
            {
                "localId": 7256,
                "createTime": 1774876692,
                "formattedTime": "2026-03-30 21:18:12",
                "type": "语音消息",
                "localType": 34,
                "content": "[语音转文字] 哦，我就在跟他说啥。",
                "isSend": 1,
                "senderUsername": "wxid_xwhr0t06uph222",
                "senderDisplayName": "开始之前",
                "platformMessageId": "7295881169448912786",
            },
            {
                "localId": 99,
                "createTime": 1774023590,
                "formattedTime": "2026-03-21 00:19:50",
                "type": "引用消息",
                "localType": 244813135921,
                "content": "没说过坏话[引用 Sample Contact：你在背后都是说我坏话的吗]",
                "isSend": 1,
                "senderUsername": "wxid_xwhr0t06uph222",
                "senderDisplayName": "开始之前",
                "platformMessageId": "8093791101060272488",
                "replyToMessageId": "660040432051139369",
                "quotedSender": "Sample Contact",
                "quotedContent": "你在背后都是说我坏话的吗",
            },
        ],
    }

    export_path = texts_dir / "私聊_Sample Contactjson"
    export_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    conversation = parser.normalize_source(export_path, "Sample Contact")[0]

    assert conversation["source"] == "wechat"

    participants = {item["name"]: item for item in conversation["participants"]}
    assert participants["开始之前"]["role"] == "user"
    assert participants["Sample Contact"]["role"] == "target"

    by_id = {message["id"]: message for message in conversation["messages"]}
    assert by_id["8941163891350392838"]["role"] == "user"
    assert by_id["1889718664619523184"]["role"] == "target"

    sticker_assets = by_id["5366124858768412427"]["assets"]
    assert sticker_assets[0]["kind"] == "sticker"
    assert sticker_assets[0]["sticker_id"] == "572c031ccfb0efaf792a8ae07ae31708"
    assert sticker_assets[0]["path"].endswith("572c031ccfb0efaf792a8ae07ae31708.gif")

    image_assets = by_id["7153093863782308975"]["assets"]
    assert image_assets[0]["kind"] == "image"
    assert image_assets[0]["path"].endswith("242_example.png")

    voice_assets = by_id["7295881169448912786"]["assets"]
    assert voice_assets[0]["kind"] == "voice"
    assert voice_assets[0]["path"].endswith("voice_wxid_8gihiybgo4vc22_7256_demo.wav")

    assert by_id["8093791101060272488"]["reply_to"] == "660040432051139369"
