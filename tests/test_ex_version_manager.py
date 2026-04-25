import json
import subprocess
import sys
from pathlib import Path


WORKSPACE = Path(r"<workspace>")
VERSION_MANAGER = WORKSPACE / "前任skill" / "tools" / "version_manager.py"


def run_version_manager(*args: str, check: bool = True, capture_output: bool = False):
    return subprocess.run(
        [sys.executable, str(VERSION_MANAGER), *args],
        check=check,
        capture_output=capture_output,
        text=True,
    )


def test_version_manager_lists_and_rolls_back_versions(tmp_path):
    base_dir = tmp_path / "profiles"
    skill_dir = base_dir / "xiaomei"
    version_dir = skill_dir / "versions" / "v1"
    version_dir.mkdir(parents=True)

    current_files = {
        "SKILL.md": "# Skill\ncurrent",
        "memories.md": "# Memories\ncurrent",
        "persona.md": "# Persona\ncurrent",
        "relationship_context.md": "# Relationship\ncurrent",
        "response_patterns.md": "# Response\ncurrent",
        "sticker_profile.json": json.dumps({"style": "current"}, ensure_ascii=False),
    }
    for name, content in current_files.items():
        (skill_dir / name).write_text(content, encoding="utf-8")

    restored_files = {
        "SKILL.md": "# Skill\nv1",
        "memories.md": "# Memories\nv1",
        "persona.md": "# Persona\nv1",
        "relationship_context.md": "# Relationship\nv1",
        "sticker_profile.json": json.dumps({"style": "v1"}, ensure_ascii=False),
    }
    for name, content in restored_files.items():
        (version_dir / name).write_text(content, encoding="utf-8")

    meta_path = skill_dir / "meta.json"
    meta_path.write_text(
        json.dumps({"name": "Xiaomei", "current_version": "draft"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    listed_before = run_version_manager(
        "--action",
        "list",
        "--slug",
        "xiaomei",
        "--base-dir",
        str(base_dir),
        capture_output=True,
    )
    assert listed_before.stdout.strip().splitlines() == ["v1"]

    run_version_manager(
        "--action",
        "rollback",
        "--slug",
        "xiaomei",
        "--version",
        "v1",
        "--base-dir",
        str(base_dir),
    )

    backup_dirs = sorted(path.name for path in (skill_dir / "versions").iterdir() if path.name.startswith("backup_before_v1"))
    assert backup_dirs == ["backup_before_v1_001"]

    backup_dir = skill_dir / "versions" / "backup_before_v1_001"
    assert backup_dir.is_dir()
    assert (backup_dir / "SKILL.md").read_text(encoding="utf-8") == "# Skill\ncurrent"
    assert (backup_dir / "response_patterns.md").read_text(encoding="utf-8") == "# Response\ncurrent"
    assert json.loads((backup_dir / "sticker_profile.json").read_text(encoding="utf-8"))["style"] == "current"

    assert (skill_dir / "persona.md").read_text(encoding="utf-8") == "# Persona\nv1"
    assert (skill_dir / "relationship_context.md").read_text(encoding="utf-8") == "# Relationship\nv1"
    assert not (skill_dir / "response_patterns.md").exists()
    assert json.loads((skill_dir / "sticker_profile.json").read_text(encoding="utf-8"))["style"] == "v1"

    (skill_dir / "SKILL.md").write_text("# Skill\ncurrent-again", encoding="utf-8")
    (skill_dir / "response_patterns.md").write_text("# Response\ncurrent-again", encoding="utf-8")

    run_version_manager(
        "--action",
        "rollback",
        "--slug",
        "xiaomei",
        "--version",
        "v1",
        "--base-dir",
        str(base_dir),
    )

    backup_dirs = sorted(path.name for path in (skill_dir / "versions").iterdir() if path.name.startswith("backup_before_v1"))
    assert backup_dirs == ["backup_before_v1_001", "backup_before_v1_002"]
    assert (skill_dir / "versions" / "backup_before_v1_002" / "SKILL.md").read_text(encoding="utf-8") == "# Skill\ncurrent-again"
    assert (skill_dir / "versions" / "backup_before_v1_002" / "response_patterns.md").read_text(encoding="utf-8") == "# Response\ncurrent-again"

    listed_after = run_version_manager(
        "--action",
        "list",
        "--slug",
        "xiaomei",
        "--base-dir",
        str(base_dir),
        capture_output=True,
    )
    assert listed_after.stdout.strip().splitlines() == ["v1"]

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert meta["current_version"] == "v1"
