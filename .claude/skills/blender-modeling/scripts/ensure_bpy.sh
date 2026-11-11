#!/usr/bin/env bash
# Prints the PYTHONPATH that makes `import bpy` work, installing Blender's Python module if needed.
# Usage:  export PYTHONPATH="$(bash ensure_bpy.sh)"
set -e
python3 -c "import bpy" 2>/dev/null && { echo "${PYTHONPATH:-}"; exit 0; }
DIR="${BPY_HOME:-$HOME/.cache/bpy-env}"
if [ ! -d "$DIR/bpy" ]; then
  mkdir -p "$DIR"
  # bpy wheels exist for one Python minor version per Blender release; pip picks the matching one or fails clearly.
  pip install --quiet --target "$DIR" bpy 1>&2
fi
PYTHONPATH="$DIR" python3 -c "import bpy; import sys; print('bpy', bpy.app.version_string, file=sys.stderr)"
echo "$DIR"
