#!/usr/bin/env bash
# Fixes the Tauri-generated bundle_dmg.sh to accept no arguments
# Run this after a failed build to patch the script, then rebuild

set -e

SCRIPT_PATH="target/release/bundle/dmg/bundle_dmg.sh"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Error: $SCRIPT_PATH not found"
  echo "Run 'npm run tauri build' first to generate the script"
  exit 1
fi

echo "Fixing $SCRIPT_PATH..."

# Use perl to do an in-place edit
perl -i.bak -pe '
  if (/^done$/) {
    $_ .= "\n\n";
    $_ .= "# If no arguments provided, use defaults for Tauri bundling\n";
    $_ .= "if [[ -z \"\$1\" ]]; then\n";
    $_ .= "\tSCRIPT_DIR_TEMP=\"\$( cd \"\$( dirname \"\${BASH_SOURCE[0]}\" )\" && pwd )\"\n";
    $_ .= "\tDMG_PATH=\"\${SCRIPT_DIR_TEMP}/Chinotto_0.1.0_aarch64.dmg\"\n";
    $_ .= "\tSRC_FOLDER=\"\${SCRIPT_DIR_TEMP}/../macos\"\n";
    $_ .= "\tSKIP_JENKINS=1\n";
    $_ .= "\tSANDBOX_SAFE=1\n";
    $_ .= "else\n";
    # Mark that we need to skip the original check
    $in_replacement = 1;
  }
  
  # Skip the original argument check
  if ($in_replacement && /^if \[\[ -z "\$2" \]\]; then/) {
    $_ = "\tif [[ -z \"\$2\" ]]; then\n";
    next;
  }
  
  if ($in_replacement && /^DMG_PATH=/) {
    $_ = "\tDMG_PATH=\"\$1\"\n";
    next;
  }
  
  if ($in_replacement && /^SRC_FOLDER=/) {
    $_ = "\tSRC_FOLDER=\"\$(cd \"\$2\" > /dev/null; pwd)\"\n";
    $_ .= "fi\n";
    $in_replacement = 0;
  }
' "$SCRIPT_PATH"

echo "✓ Fixed! You can now run 'npm run tauri build' again"
