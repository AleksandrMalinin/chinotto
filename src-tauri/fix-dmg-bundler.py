#!/usr/bin/env python3
"""Patch bundle_dmg.sh to accept no arguments (Tauri calls it with none)."""
import os
import sys

path = os.environ.get("FIX_DMG_SCRIPT_PATH")
if not path or not os.path.isfile(path):
    sys.exit(1)

with open(path) as f:
    s = f.read()

old = '''if [[ -z "$2" ]]; then
	echo "Not enough arguments. Run 'create-dmg --help' for help."
	exit 1
fi

DMG_PATH="$1"
SRC_FOLDER="$(cd "$2" > /dev/null; pwd)"'''

new = '''# Tauri calls with no args; use defaults when $1 is empty
if [[ -z "$1" ]]; then
	SCRIPT_DIR_TEMP="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
	DMG_PATH="${SCRIPT_DIR_TEMP}/Chinotto_0.2.0_aarch64.dmg"
	SRC_FOLDER="${SCRIPT_DIR_TEMP}/../macos"
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
