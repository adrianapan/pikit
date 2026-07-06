#!/usr/bin/env bash
# setup.sh — scaffolds Pikit's opinionated files into ~/.pi/agent from the
# installed package.
#
# Sources are resolved relative to this script (dirname BASH_SOURCE), so the
# version matches exactly what the user installed — never a git branch.
# Re-running setup.sh re-pulls APPEND_SYSTEM.md when it has changed (backing
# up the old one) — that's the sync path for package users.
#
# Clone users don't need setup.sh (the repo lives at ~/.pi, so these files
# are already in place and git-owned). A src===dest guard prevents a self-copy
# from blanking a file if a clone user runs it anyway.
#
# Usage:
#   bash setup.sh                 # scaffold everything
#   bash setup.sh --keybindings   # only keybindings.json
#   bash setup.sh --modes         # only chat-mode/plan-mode presets
#   bash setup.sh --settings --system-prompt
#   bash setup.sh --help

set -euo pipefail

# --- paths ------------------------------------------------------------------

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
SRC="${SCRIPT_DIR}/agent"

AGENT_DIR="${HOME}/.pi/agent"
mkdir -p "$AGENT_DIR"
AGENT_DIR=$(cd "$AGENT_DIR" && pwd -P)   # canonical, for the src===dest guard
CONFIGS_DIR="${AGENT_DIR}/configs"
BAK_DIR="${AGENT_DIR}/_bak"

# --- kit-owned keybindings forced into ~/.pi/agent/keybindings.json ---------

# Parallel indexed arrays (kept in lockstep) — portable to bash 3.2.
KB_KEYS=("app.model.cycleForward" "app.thinking.cycle")
KB_VALS=("ctrl+shift+m" "ctrl+shift+t")

# --- flags ------------------------------------------------------------------

RUN_SETTINGS=0
RUN_SYSTEM_PROMPT=0
RUN_MODES=0
RUN_KEYBINDINGS=0

usage() {
  cat <<'EOF'
setup.sh — scaffold Pikit's opinionated files into ~/.pi/agent

Usage:
  bash setup.sh [flags]

Flags:
  --settings          Sync settings.json (theme: "slop")
  --system-prompt     Sync APPEND_SYSTEM.md
  --modes             Sync configs/chat-mode.json + configs/plan-mode.json
  --keybindings       Sync keybindings.json (the two Pikit keybinds)
  --help, -h          Show this help

No flag runs every job, in order: settings, system-prompt, modes, keybindings.
Existing files are backed up to ~/.pi/agent/_bak/ before being replaced;
already-correct files are skipped, so re-running is safe.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --settings)         RUN_SETTINGS=1; shift ;;
    --system-prompt)    RUN_SYSTEM_PROMPT=1; shift ;;
    --modes)            RUN_MODES=1; shift ;;
    --keybindings)      RUN_KEYBINDINGS=1; shift ;;
    --help|-h)          usage; exit 0 ;;
    *)                  echo "Unknown flag: $1" >&2; echo "Run 'bash setup.sh --help'." >&2; exit 1 ;;
  esac
done

if [[ $RUN_SETTINGS -eq 0 && $RUN_SYSTEM_PROMPT -eq 0 && $RUN_MODES -eq 0 && $RUN_KEYBINDINGS -eq 0 ]]; then
  RUN_SETTINGS=1
  RUN_SYSTEM_PROMPT=1
  RUN_MODES=1
  RUN_KEYBINDINGS=1
fi

# --- deps -------------------------------------------------------------------

if ! command -v jq >/dev/null 2>&1; then
  echo "setup.sh requires jq. Install it (e.g. 'brew install jq') and re-run." >&2
  exit 1
fi

# --- helpers ----------------------------------------------------------------

notes=()

# Back up an existing file into ~/.pi/agent/_bak/<flattened-name>.<unix-ts>.
backup() {
  local rel="$1" abs="$2"
  mkdir -p "$BAK_DIR"
  local ts; ts=$(date +%s)
  cp -p "$abs" "${BAK_DIR}/${rel//\//_}.${ts}"
}

# Emit a default keybindings.json built from KB_KEYS / KB_VALS.
defaults_json() {
  local f='.' args=() i k safe
  for i in "${!KB_KEYS[@]}"; do
    k="${KB_KEYS[$i]}"
    safe="${k//./_}"
    args+=(--arg "$safe" "${KB_VALS[$i]}")
    f+=" | .[\"${k}\"] = \$${safe}"
  done
  jq -n "${args[@]}" "$f"
}

# --- jobs -------------------------------------------------------------------

# settings.json: copy from example if absent, else force theme: "slop" in place.
syncSettings() {
  local dest="${AGENT_DIR}/settings.json"
  local src="${SRC}/settings.example.json"

  if [[ ! -f "$dest" ]]; then
    cp "$src" "$dest"
    notes+=("created|settings.json|theme set to 'slop', quiet startup enabled")
    return
  fi

  if ! jq empty "$dest" >/dev/null 2>&1; then
    backup "settings.json" "$dest"
    cp "$src" "$dest"
    notes+=("recovered|settings.json|recovered from corrupt file, theme set to 'slop', quiet startup enabled")
    return
  fi

  local theme quiet
  theme=$(jq -r '.theme // ""' "$dest")
  quiet=$(jq -r '.quietStartup // ""' "$dest")
  if [[ "$theme" == "slop" && "$quiet" == "true" ]]; then
    notes+=("skipped|settings.json|skipped")
    return
  fi

  backup "settings.json" "$dest"
  local tmp; tmp=$(mktemp)
  jq '.theme = "slop" | .quietStartup = true' "$dest" > "$tmp"
  mv "$tmp" "$dest"
  notes+=("updated|settings.json|theme set to 'slop', quiet startup enabled")
}

# APPEND_SYSTEM.md: write ours, or back up + overwrite if it changed.
syncAppendSystem() {
  local src="${SRC}/APPEND_SYSTEM.md"
  local dest="${AGENT_DIR}/APPEND_SYSTEM.md"

  # Clone guard: repo lives at ~/.pi → src === dest. Self-copy would blank
  # the file. Skip; clone users manage this via git.
  if [[ "$src" == "$dest" ]]; then
    notes+=("skipped|APPEND_SYSTEM.md|skipped")
    return
  fi

  if [[ ! -f "$dest" ]]; then
    cp "$src" "$dest"
    notes+=("created|APPEND_SYSTEM.md|loaded additional system prompt")
    return
  fi

  # Already current? Skip — avoids a useless backup on re-run without an upgrade.
  if cmp -s "$src" "$dest"; then
    notes+=("skipped|APPEND_SYSTEM.md|skipped")
    return
  fi

  backup "APPEND_SYSTEM.md" "$dest"
  cp "$src" "$dest"
  notes+=("updated|APPEND_SYSTEM.md|reloaded additional system prompt")
}

# configs/chat-mode.json + plan-mode.json: copy ours if absent, skip if present.
syncModeConfigs() {
  mkdir -p "$CONFIGS_DIR"
  local name desc src dest
  for name in chat-mode.json plan-mode.json; do
    case "$name" in
      chat-mode.json) desc="added chat-mode shortcut: shift+tab" ;;
      plan-mode.json) desc="added plan-mode shortcut: alt+shift+tab" ;;
    esac
    src="${SRC}/configs/${name}"
    dest="${CONFIGS_DIR}/${name}"
    if [[ -f "$dest" || "$src" == "$dest" ]]; then
      notes+=("skipped|configs/${name}|skipped")
      continue
    fi
    cp "$src" "$dest"
    notes+=("created|configs/${name}|${desc}")
  done
}

# keybindings.json: write kit defaults if absent, else force the 2 kit fields in place.
syncKeybindings() {
  local dest="${AGENT_DIR}/keybindings.json"
  local count=${#KB_KEYS[@]}
  local values; values=$(IFS=,; echo "${KB_VALS[*]}")

  if [[ ! -f "$dest" ]]; then
    defaults_json > "$dest"
    notes+=("created|keybindings.json|added ${count} keybindings: ${values}")
    return
  fi

  if ! jq empty "$dest" >/dev/null 2>&1; then
    backup "keybindings.json" "$dest"
    defaults_json > "$dest"
    notes+=("recovered|keybindings.json|recovered from corrupt file, added ${count} keybindings: ${values}")
    return
  fi

  local all_match=1 i k cur
  for i in "${!KB_KEYS[@]}"; do
    k="${KB_KEYS[$i]}"
    cur=$(jq -r --arg k "$k" '.[$k] // ""' "$dest")
    [[ "$cur" == "${KB_VALS[$i]}" ]] || all_match=0
  done
  if [[ $all_match -eq 1 ]]; then
    notes+=("skipped|keybindings.json|skipped")
    return
  fi

  backup "keybindings.json" "$dest"
  local f='.' args=() i k safe
  for i in "${!KB_KEYS[@]}"; do
    k="${KB_KEYS[$i]}"
    safe="${k//./_}"
    args+=(--arg "$safe" "${KB_VALS[$i]}")
    f+=" | .[\"${k}\"] = \$${safe}"
  done
  local tmp; tmp=$(mktemp)
  jq "${args[@]}" "$f" "$dest" > "$tmp"
  mv "$tmp" "$dest"
  notes+=("updated|keybindings.json|set ${count} keybindings: ${values}")
}

# --- run --------------------------------------------------------------------

[[ $RUN_SETTINGS -eq 1 ]]       && syncSettings
[[ $RUN_SYSTEM_PROMPT -eq 1 ]]  && syncAppendSystem
[[ $RUN_MODES -eq 1 ]]          && syncModeConfigs
[[ $RUN_KEYBINDINGS -eq 1 ]]    && syncKeybindings

# --- summary ----------------------------------------------------------------

symbol() {
  case "$1" in
    created)   echo "✔" ;;
    updated)   echo "~" ;;
    recovered) echo "~" ;;
    skipped)   echo "–" ;;
  esac
}

all_skipped=1
for n in "${notes[@]}"; do
  if [[ "${n%%|*}" != "skipped" ]]; then all_skipped=0; break; fi
done

echo
if [[ $all_skipped -eq 1 ]]; then
  echo "✓ Pikit is already set up — nothing to do."
else
  echo "✓ Pikit set up — restart pi to apply the theme & system prompt."
  echo
  # width = longest label
  width=0
  for n in "${notes[@]}"; do
    label=${n#*|}; label=${label%%|*}
    (( ${#label} > width )) && width=${#label}
  done
  for n in "${notes[@]}"; do
    IFS='|' read -r outcome label desc <<< "$n"
    printf "  %s %-${width}s   %s\n" "$(symbol "$outcome")" "$label" "$desc"
  done
  backed_up=0
  for n in "${notes[@]}"; do
    case "${n%%|*}" in updated|recovered) backed_up=1; break ;; esac
  done
  if [[ $backed_up -eq 1 ]]; then
    echo
    echo "  Backups stored in the \"_bak/\" folder."
  fi
fi
echo