import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


TEXT_FILES = {
    "memories": "memories.md",
    "persona": "persona.md",
    "relationship_context": "relationship_context.md",
    "response_patterns": "response_patterns.md",
}
JSON_FILES = {
    "sticker_profile": "sticker_profile.json",
}
ALL_OUTPUTS = {**TEXT_FILES, **JSON_FILES}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(read_text(path))


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, payload: dict) -> None:
    write_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def copy_if_present(source: str | None, destination: Path) -> None:
    if not source:
        return
    shutil.copyfile(Path(source), destination)


def ensure_directories(skill_dir: Path) -> None:
    (skill_dir / "versions").mkdir(parents=True, exist_ok=True)
    (skill_dir / "knowledge").mkdir(parents=True, exist_ok=True)
    for name in ("memories", "persona", "relationship", "responses", "stickers"):
        (skill_dir / "knowledge" / name).mkdir(parents=True, exist_ok=True)


def build_skill_markdown(meta: dict, slug: str) -> str:
    display_name = meta.get("name") or slug
    return "\n".join(
        [
            f"# {display_name}",
            "",
            "Load the companion context before responding in character.",
            "",
            "## Core Files",
            f"- `meta.json` for profile metadata and version markers.",
            f"- `{TEXT_FILES['memories']}` for stable lived memories.",
            f"- `{TEXT_FILES['persona']}` for tone, boundaries, and point of view.",
            f"- `{TEXT_FILES['relationship_context']}` for the dynamic relationship lens.",
            f"- `{TEXT_FILES['response_patterns']}` for recurring reply structure and cadence.",
            f"- `{JSON_FILES['sticker_profile']}` for sticker behavior and preferred reactions.",
            "",
            "## Working Style",
            "- Read memories first, then persona, then relationship context.",
            "- Match response patterns when they fit the moment; do not force them.",
            "- Treat sticker behavior as part of expression, not decoration.",
            "- Keep continuity with the stored profile while staying responsive to new context.",
            "",
        ]
    )


def load_or_init_meta(meta_path: Path | None, slug: str, name: str | None = None) -> dict:
    if meta_path and meta_path.exists():
        meta = read_json(meta_path)
    else:
        meta = {"slug": slug}
    if name and not meta.get("name"):
        meta["name"] = name
    meta.setdefault("slug", slug)
    meta.setdefault("created_at", utc_now())
    return meta


def save_meta(skill_dir: Path, meta: dict) -> None:
    meta["updated_at"] = utc_now()
    write_json(skill_dir / "meta.json", meta)


def create_skill(args: argparse.Namespace) -> None:
    skill_dir = Path(args.base_dir) / args.slug
    skill_dir.mkdir(parents=True, exist_ok=True)
    ensure_directories(skill_dir)

    meta_path = Path(args.meta) if args.meta else None
    meta = load_or_init_meta(meta_path, args.slug, args.name)
    copy_if_present(args.memories, skill_dir / TEXT_FILES["memories"])
    copy_if_present(args.persona, skill_dir / TEXT_FILES["persona"])
    copy_if_present(args.relationship_context, skill_dir / TEXT_FILES["relationship_context"])
    copy_if_present(args.response_patterns, skill_dir / TEXT_FILES["response_patterns"])
    copy_if_present(args.sticker_profile, skill_dir / JSON_FILES["sticker_profile"])

    write_text(skill_dir / "SKILL.md", build_skill_markdown(meta, args.slug))
    meta["current_version"] = meta.get("current_version", "draft")
    save_meta(skill_dir, meta)


def apply_patch_file(destination: Path, patch_path: str | None) -> None:
    if patch_path:
        shutil.copyfile(Path(patch_path), destination)


def update_skill(args: argparse.Namespace) -> None:
    skill_dir = Path(args.base_dir) / args.slug
    if not skill_dir.exists():
        raise FileNotFoundError(f"Skill profile does not exist: {skill_dir}")

    ensure_directories(skill_dir)
    apply_patch_file(skill_dir / TEXT_FILES["memories"], args.memories_patch or args.memories)
    apply_patch_file(skill_dir / TEXT_FILES["persona"], args.persona_patch or args.persona)
    apply_patch_file(skill_dir / TEXT_FILES["relationship_context"], args.relationship_context)
    apply_patch_file(skill_dir / TEXT_FILES["response_patterns"], args.response_patterns)
    apply_patch_file(skill_dir / JSON_FILES["sticker_profile"], args.sticker_profile)

    meta_path = skill_dir / "meta.json"
    meta = load_or_init_meta(meta_path, args.slug, args.name)
    write_text(skill_dir / "SKILL.md", build_skill_markdown(meta, args.slug))
    save_meta(skill_dir, meta)


def list_skills(args: argparse.Namespace) -> None:
    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        return
    for item in sorted(path for path in base_dir.iterdir() if path.is_dir()):
        print(item.name)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage distilled ex-skill profiles.")
    parser.add_argument("--action", choices=("create", "update", "list"), required=True)
    parser.add_argument("--slug")
    parser.add_argument("--name")
    parser.add_argument("--meta")
    parser.add_argument("--memories")
    parser.add_argument("--memories-patch")
    parser.add_argument("--persona")
    parser.add_argument("--persona-patch")
    parser.add_argument("--relationship-context")
    parser.add_argument("--response-patterns")
    parser.add_argument("--sticker-profile")
    parser.add_argument("--base-dir", default=str(Path(__file__).resolve().parents[1] / "exes"))
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.action == "create":
        create_skill(args)
        return
    if args.action == "update":
        update_skill(args)
        return
    list_skills(args)


if __name__ == "__main__":
    main()
