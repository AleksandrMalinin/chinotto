#!/usr/bin/env python3
"""Patch bundle_dmg.sh to accept no arguments (Tauri calls it with none)."""
import json
import os
import platform
import sys
from pathlib import Path

path = os.environ.get("FIX_DMG_SCRIPT_PATH")
if not path or not os.path.isfile(path):
    sys.exit(1)

root = Path(__file__).resolve().parent
conf = json.loads((root / "tauri.conf.json").read_text(encoding="utf-8"))
version = conf["version"]
pname = conf["productName"].replace(" ", "_")
mach = platform.machine()
if mach == "arm64":
    arch = "aarch64"
elif mach == "x86_64":
    arch = "x86_64"
else:
    arch = mach
dmg_file = f"{pname}_{version}_{arch}.dmg"

with open(path) as f:
    s = f.read()

old = '''if [[ -z "$2" ]]; then
	echo "Not enough arguments. Run 'create-dmg --help' for help."
	exit 1
fi

DMG_PATH="$1"
SRC_FOLDER="$(cd "$2" > /dev/null; pwd)"'''

new = f'''# Tauri calls with no args; use defaults when $1 is empty
if [[ -z "$1" ]]; then
	SCRIPT_DIR_TEMP="$( cd "$( dirname "${{BASH_SOURCE[0]}}" )" && pwd )"
	DMG_PATH="${{SCRIPT_DIR_TEMP}}/{dmg_file}"
	SRC_FOLDER="${{SCRIPT_DIR_TEMP}}/../macos"
	SKIP_JENKINS=1
	SANDBOX_SAFE=1
else
	DMG_PATH="$1"
	SRC_FOLDER="$(cd "$2" > /dev/null; pwd)"
fi'''

if old not in s:
    sys.exit(1)
with open(path, "w") as f:
    f.write(s.replace(old, new, 1))
print(f"Patched default DMG output: {dmg_file}", file=sys.stderr)
