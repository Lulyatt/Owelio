#!/usr/bin/env bash
# Resolve uv on Windows Git Bash / make (HOME and PATH are often wrong).
set -eo pipefail

to_unix_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath "$p"
  elif [[ "$p" =~ ^[A-Za-z]:\\ ]]; then
    local drive="${p:0:1}"
    p="${p:2}"
    p="${p//\\//}"
    printf '/%s%s' "$(echo "$drive" | tr 'A-Z' 'a-z')" "$p"
  else
    printf '%s' "$p"
  fi
}

try_uv() {
  local bin="$1"
  shift
  if [ -f "$bin" ]; then
    exec "$bin" "$@"
  fi
}

if [ -n "${OWELIO_UV:-}" ]; then
  try_uv "${OWELIO_UV}" "$@"
fi

for h in "${HOME:-}" "${USERPROFILE:-}"; do
  [ -n "$h" ] || continue
  if [[ "$h" == [A-Za-z]:* ]]; then
    h="$(to_unix_path "$h")"
  fi
  try_uv "${h}/.local/bin/uv.exe" "$@"
  try_uv "${h}/.local/bin/uv" "$@"
done

for u in "${USERNAME:-}" "${LOGNAME:-}"; do
  [ -n "$u" ] || continue
  try_uv "/c/Users/${u}/.local/bin/uv.exe" "$@"
  try_uv "/c/Users/${u}/.local/bin/uv" "$@"
done

if [ -n "${LOCALAPPDATA:-}" ]; then
  la="$(to_unix_path "$LOCALAPPDATA")"
elif [ -n "${USERPROFILE:-}" ]; then
  la="$(to_unix_path "$USERPROFILE")/AppData/Local"
else
  la=""
fi

if [ -n "$la" ] && [ -d "$la/Microsoft/WinGet/Packages" ]; then
  for pkg in "$la/Microsoft/WinGet/Packages"/astral-sh.uv_*; do
    [ -d "$pkg" ] || continue
    try_uv "$pkg/uv.exe" "$@"
  done
fi

if command -v uv >/dev/null 2>&1; then
  exec uv "$@"
fi

echo "uv not found. Install: winget install astral-sh.uv" >&2
echo "Or: export OWELIO_UV=\"/c/Users/YOU/.local/bin/uv.exe\"  (Git Bash path)" >&2
echo "Optional: export PATH=\"\$HOME/.local/bin:\$PATH\" in ~/.bashrc" >&2
exit 127
