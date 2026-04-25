from __future__ import annotations

import argparse
import sys


MESSAGE = "该解析器保留上游文件名，等待接入你的导出格式。"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Placeholder parser for SMS exports.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", help="Input file path.")
    group.add_argument("--dir", help="Input directory path.")
    parser.add_argument("--target", help="Target speaker name or identifier.", default=None)
    parser.add_argument("--output", help="Output file path.", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    build_parser().parse_args(argv)
    sys.stderr.write(MESSAGE + "\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
