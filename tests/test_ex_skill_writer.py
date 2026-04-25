import json
import subprocess
import sys
from pathlib import Path


WORKSPACE = Path(r"<workspace>")
WRITER = WORKSPACE / "前任skill" / "tools" / "skill_writer.py"


def test_skill_writer_creates_profile_directory_and_required_files(tmp_path):
    base_dir = tmp_path / "profiles"
    input_dir = tmp_path / "input"
    input_dir.mkdir()

    meta = input_dir / "meta.json"
    meta.write_text(
        json.dumps({"name": "Xiaomei", "slug": "xiaomei"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    memories = input_dir / "memories.md"
    memories.write_text("# Memories\nWent to the seaside together.", encoding="utf-8")
    persona = input_dir / "persona.md"
    persona.write_text("# Persona\nWarm but stubborn.", encoding="utf-8")
    relationship_context = input_dir / "relationship_context.md"
    relationship_context.write_text("# Relationship Context\nShares in-jokes.", encoding="utf-8")
    response_patterns = input_dir / "response_patterns.md"
    response_patterns.write_text("# Response Patterns\nTease first, answer next.", encoding="utf-8")
    sticker_profile = input_dir / "sticker_profile.json"
    sticker_profile.write_text(
        json.dumps({"default_style": "playful", "favorites": ["cat-smirk"]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    subprocess.run(
        [
            sys.executable,
            str(WRITER),
            "--action",
            "create",
            "--slug",
            "xiaomei",
            "--name",
            "Xiaomei",
            "--meta",
            str(meta),
            "--memories",
            str(memories),
            "--persona",
            str(persona),
            "--relationship-context",
            str(relationship_context),
            "--response-patterns",
            str(response_patterns),
            "--sticker-profile",
            str(sticker_profile),
            "--base-dir",
            str(base_dir),
        ],
        check=True,
    )

    skill_dir = base_dir / "xiaomei"
    assert skill_dir.is_dir()
    assert (skill_dir / "SKILL.md").exists()
    assert (skill_dir / "relationship_context.md").exists()
    assert (skill_dir / "response_patterns.md").exists()

    skill_text = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
    assert "relationship_context.md" in skill_text
    assert "response_patterns.md" in skill_text
    assert "sticker_profile.json" in skill_text


def test_skill_writer_create_without_meta_still_writes_meta_json(tmp_path):
    base_dir = tmp_path / "profiles"
    input_dir = tmp_path / "input"
    input_dir.mkdir()

    memories = input_dir / "memories.md"
    memories.write_text("# Memories\nA small memory.", encoding="utf-8")
    persona = input_dir / "persona.md"
    persona.write_text("# Persona\nDry humor.", encoding="utf-8")

    subprocess.run(
        [
            sys.executable,
            str(WRITER),
            "--action",
            "create",
            "--slug",
            "nometa",
            "--name",
            "NoMeta",
            "--memories",
            str(memories),
            "--persona",
            str(persona),
            "--base-dir",
            str(base_dir),
        ],
        check=True,
    )

    meta = json.loads((base_dir / "nometa" / "meta.json").read_text(encoding="utf-8"))
    assert meta["slug"] == "nometa"
    assert meta["name"] == "NoMeta"
    assert meta["current_version"] == "draft"
