import importlib.util
import zipfile
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "profile_packager.py"
SPEC = importlib.util.spec_from_file_location("profile_packager", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)
build_package_manifest = MODULE.build_package_manifest
package_profile = MODULE.package_profile


def test_package_profile_writes_required_files(tmp_path: Path):
    profile_dir = tmp_path / "demo"
    profile_dir.mkdir()
    for name, content in {
        "meta.json": "{}",
        "persona.md": "# Persona",
        "relationship_context.md": "# Relationship",
        "response_patterns.md": "# Response",
        "memories.md": "# Memories",
        "sticker_profile.json": "{}",
        "sticker_library.json": '{"count": 0, "stickers": []}',
    }.items():
        (profile_dir / name).write_text(content, encoding="utf-8")

    output_zip = tmp_path / "demo.exprofile.zip"
    package_profile(profile_dir, output_zip)

    with zipfile.ZipFile(output_zip) as archive:
        assert "profile/meta.json" in archive.namelist()
        assert "manifest.json" in archive.namelist()


def test_package_profile_writes_enhanced_ex_skill_files(tmp_path: Path):
    profile_dir = tmp_path / "demo"
    profile_dir.mkdir()
    for name, content in {
        "meta.json": '{"slug": "demo", "format": "ex-skill"}',
        "SKILL.md": "# Demo Skill\n\nReturn structured JSON.",
        "persona.md": "# Persona",
        "relationship_context.md": "# Relationship",
        "response_patterns.md": "# Response",
        "memories.md": "# Memories",
        "sticker_profile.json": "{}",
        "sticker_library.json": '{"count": 0, "stickers": []}',
    }.items():
        (profile_dir / name).write_text(content, encoding="utf-8")

    (profile_dir / "knowledge").mkdir()
    (profile_dir / "knowledge" / "notes.md").write_text("# Notes", encoding="utf-8")
    (profile_dir / "versions").mkdir()
    (profile_dir / "versions" / "v1").mkdir()
    (profile_dir / "versions" / "v1" / "meta.json").write_text("{}", encoding="utf-8")

    output_zip = tmp_path / "demo.exprofile.zip"
    package_profile(profile_dir, output_zip)

    manifest = build_package_manifest(profile_dir)
    assert manifest["format"] == "ex-skill"
    assert manifest["runtime"]["preferredPrompt"] == "SKILL.md"
    assert manifest["runtime"]["outputProtocol"] == "structured-messages-v1"

    with zipfile.ZipFile(output_zip) as archive:
        names = archive.namelist()
        assert "SKILL.md" in names
        assert "meta.json" in names
        assert "persona.md" in names
        assert "memories.md" in names
        assert "profile/SKILL.md" in names
        assert "profile/meta.json" in names
        assert "knowledge/notes.md" in names
        assert "versions/v1/meta.json" in names


def test_package_profile_resolves_relative_sticker_paths_from_profile_dir(tmp_path: Path):
    profile_dir = tmp_path / "demo"
    profile_dir.mkdir()
    stickers_dir = profile_dir / "stickers"
    stickers_dir.mkdir()
    (stickers_dir / "abc123.png").write_bytes(b"fake-png")
    for name, content in {
        "meta.json": "{}",
        "persona.md": "# Persona",
        "relationship_context.md": "# Relationship",
        "response_patterns.md": "# Response",
        "memories.md": "# Memories",
        "sticker_profile.json": "{}",
        "sticker_library.json": '{"count": 1, "stickers": [{"md5": "abc123", "path": "stickers/abc123.png"}]}',
    }.items():
        (profile_dir / name).write_text(content, encoding="utf-8")

    output_zip = tmp_path / "demo.exprofile.zip"
    package_profile(profile_dir, output_zip)

    with zipfile.ZipFile(output_zip) as archive:
        assert "stickers/abc123.png" in archive.namelist()


def test_package_profile_uses_sticker_profile_path_when_library_asset_is_missing(tmp_path: Path):
    profile_dir = tmp_path / "demo"
    profile_dir.mkdir()
    source_dir = tmp_path / "source-emojis"
    source_dir.mkdir()
    source = source_dir / "abc123.png"
    source.write_bytes(b"fake-png")
    for name, content in {
        "meta.json": "{}",
        "persona.md": "# Persona",
        "relationship_context.md": "# Relationship",
        "response_patterns.md": "# Response",
        "memories.md": "# Memories",
        "sticker_profile.json": '{"high_frequency_md5": [{"md5": "abc123", "path": "' + source.as_posix() + '"}]}',
        "sticker_library.json": '{"count": 1, "stickers": [{"md5": "abc123", "path": "stickers/abc123.png"}]}',
    }.items():
        (profile_dir / name).write_text(content, encoding="utf-8")

    output_zip = tmp_path / "demo.exprofile.zip"
    package_profile(profile_dir, output_zip)

    with zipfile.ZipFile(output_zip) as archive:
        assert "stickers/abc123.png" in archive.namelist()
