import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


TRACKED_FILES = [
    "SKILL.md",
    "memories.md",
    "persona.md",
    "relationship_context.md",
    "response_patterns.md",
    "sticker_profile.json",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def skill_dir(base_dir: str, slug: str) -> Path:
    return Path(base_dir) / slug


def versions_dir(base_dir: str, slug: str) -> Path:
    return skill_dir(base_dir, slug) / "versions"


def next_backup_dir(root: Path, target_version: str) -> Path:
    prefix = f"backup_before_{target_version}_"
    highest = 0
    for path in root.iterdir():
        if not path.is_dir() or not path.name.startswith(prefix):
            continue
        suffix = path.name.removeprefix(prefix)
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return root / f"{prefix}{highest + 1:03d}"


def list_versions(args: argparse.Namespace) -> None:
    root = versions_dir(args.base_dir, args.slug)
    if not root.exists():
        return
    for version in sorted(
        path.name
        for path in root.iterdir()
        if path.is_dir() and not path.name.startswith("backup_before_")
    ):
        print(version)


def archive_current_state(current_dir: Path, target_version: str) -> None:
    versions_root = current_dir / "versions"
    versions_root.mkdir(parents=True, exist_ok=True)
    backup_dir = next_backup_dir(versions_root, target_version)
    backup_dir.mkdir(parents=True, exist_ok=True)

    for name in TRACKED_FILES:
        source = current_dir / name
        if source.exists():
            shutil.copyfile(source, backup_dir / name)


def rollback(args: argparse.Namespace) -> None:
    current_dir = skill_dir(args.base_dir, args.slug)
    archived_version_dir = versions_dir(args.base_dir, args.slug) / args.version
    if not archived_version_dir.exists():
        raise FileNotFoundError(f"Version does not exist: {archived_version_dir}")

    archive_current_state(current_dir, args.version)

    for name in TRACKED_FILES:
        source = archived_version_dir / name
        destination = current_dir / name
        if source.exists():
            shutil.copyfile(source, destination)
        elif destination.exists():
            destination.unlink()

    meta_path = current_dir / "meta.json"
    meta = read_json(meta_path) if meta_path.exists() else {"slug": args.slug}
    meta["current_version"] = args.version
    meta["rolled_back_at"] = utc_now()
    write_json(meta_path, meta)


def cleanup(args: argparse.Namespace) -> None:
    root = versions_dir(args.base_dir, args.slug)
    if not root.exists():
        return
    for path in root.iterdir():
        if path.is_dir() and not any(path.iterdir()):
            path.rmdir()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="List, rollback, or clean ex-skill versions.")
    parser.add_argument("--action", choices=("list", "rollback", "cleanup"), required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--version")
    parser.add_argument("--base-dir", default=str(Path(__file__).resolve().parents[1] / "exes"))
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.action == "list":
        list_versions(args)
        return
    if args.action == "rollback":
        if not args.version:
            raise SystemExit("--version is required for rollback")
        rollback(args)
        return
    cleanup(args)


if __name__ == "__main__":
    main()
