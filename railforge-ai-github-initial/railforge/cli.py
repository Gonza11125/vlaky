from __future__ import annotations

import argparse
from pathlib import Path

from .exporters import export_route
from .routes import load_route


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="railforge", description="RailForge AI route generator")
    sub = parser.add_subparsers(dest="command", required=True)

    generate = sub.add_parser("generate", help="Generate route outputs")
    generate.add_argument("route", help="Route id or alias, e.g. 175 or p21")
    generate.add_argument("--output", default="output", help="Output directory")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "generate":
        route = load_route(args.route)
        out_dir = Path(args.output) / route.id
        files = export_route(route, out_dir)
        print(f"Generated {route.name}")
        for file in files:
            print(f"- {file}")
        return 0

    parser.error("Unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
