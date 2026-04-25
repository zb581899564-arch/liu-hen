import argparse
import json
import zipfile
from pathlib import Path


REQUIRED = [
    "meta.json",
    "persona.md",
    "relationship_context.md",
    "response_patterns.md",
    "memories.md",
    "sticker_profile.json",
    "sticker_library.json",
]

CORE_EX_SKILL_FILES = [
    "meta.json",
    "SKILL.md",
    "persona.md",
    "memories.md",
]

OPTIONAL_PROFILE_FILES = [
    "SKILL.md",
]

OPTIONAL_PROFILE_DIRS = [
    "knowledge",
    "versions",
]


def build_package_manifest(profile_dir: Path) -> dict:
    meta = json.loads((profile_dir / "meta.json").read_text(encoding="utf-8"))
    participants = meta.get("participants", {})
    file_names = [name for name in [*REQUIRED, *OPTIONAL_PROFILE_FILES] if (profile_dir / name).exists()]
    package_format = meta.get("format") or ("ex-skill" if (profile_dir / "SKILL.md").exists() else "ex-profile-package-v1")
    manifest = {
        "slug": meta.get("slug"),
        "name": meta.get("name") or meta.get("displayName") or participants.get("target"),
        "format": package_format,
        "files": file_names,
    }

    runtime = meta.get("runtime")
    if runtime:
        manifest["runtime"] = runtime
    elif (profile_dir / "SKILL.md").exists():
        manifest["runtime"] = {
            "preferredPrompt": "SKILL.md",
            "outputProtocol": "structured-messages-v1",
            "supportsScheduledMessages": True,
            "supportsStickers": True,
        }

    return {
        **manifest,
    }


def package_sticker_assets(archive: zipfile.ZipFile, profile_dir: Path) -> None:
    library = json.loads((profile_dir / "sticker_library.json").read_text(encoding="utf-8"))
    sticker_profile_path = profile_dir / "sticker_profile.json"
    profile_sources = {}
    if sticker_profile_path.exists():
        profile = json.loads(sticker_profile_path.read_text(encoding="utf-8"))
        for item in profile.get("high_frequency_md5", []):
            if item.get("md5") and item.get("path"):
                profile_sources[item["md5"]] = item["path"]

    for sticker in library.get("stickers", []):
        source = Path(sticker["path"])
        if not source.is_absolute():
            source = profile_dir / source
        if not source.exists() and sticker.get("md5") in profile_sources:
            source = Path(profile_sources[sticker["md5"]])
        if not source.exists():
            continue
        ext = source.suffix.lower()
        archive.write(source, f"stickers/{sticker['md5']}{ext}")


def package_profile(profile_dir: Path, output_zip: Path) -> None:
    manifest = build_package_manifest(profile_dir)
    with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        for file_name in manifest["files"]:
            source = profile_dir / file_name
            archive.write(source, f"profile/{file_name}")
            archive.write(source, file_name)
        for directory_name in OPTIONAL_PROFILE_DIRS:
            directory = profile_dir / directory_name
            if not directory.exists():
                continue
            for source in sorted(path for path in directory.rglob("*") if path.is_file()):
                archive.write(source, source.relative_to(profile_dir).as_posix())
        package_sticker_assets(archive, profile_dir)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    package_profile(Path(args.profile_dir), Path(args.output))


if __name__ == "__main__":
    main()
