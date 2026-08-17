#!/usr/bin/env bash
#
# Interview demo driver.
#
#   ./demo/demo.sh check     health-check the app under test (run this first)
#   ./demo/demo.sh 1         show the suite passing
#   ./demo/demo.sh 2         show the guardrails catching a bad test
#   ./demo/demo.sh 3         show the quality gates
#   ./demo/demo.sh 4         show the UI tests in a real browser
#
# Each step pauses so you can talk over it. Press Enter to continue.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; RED=$'\033[31m'
YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'

banner() { printf '\n%s%s%s\n%s\n' "$BOLD$CYAN" "$1" "$RESET" "${DIM}$(printf '─%.0s' {1..70})$RESET"; }
pause()  { printf '\n%s[Enter to continue]%s' "$DIM" "$RESET"; read -r _; }

check_app() {
  local api ui
  api=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/api/articles 2>/dev/null || echo 000)
  ui=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:4101 2>/dev/null || echo 000)

  printf '  backend  :3000  '
  [ "$api" = "200" ] && printf '%sUP%s\n' "$GREEN" "$RESET" || printf '%sDOWN%s\n' "$RED" "$RESET"
  printf '  frontend :4101  '
  [ "$ui" = "200" ] && printf '%sUP%s\n' "$GREEN" "$RESET" || printf '%sDOWN%s\n' "$RED" "$RESET"

  if [ "$api" != "200" ] || [ "$ui" != "200" ]; then
    printf '\n%sApp is not running. Start it in another terminal:%s\n' "$YELLOW" "$RESET"
    printf '  cd ~/conduit-app-under-test && npm run dev\n'
    printf '\nThen wait for "Compiled successfully!" and re-run this check.\n'
    return 1
  fi
  printf '\n%sReady to demo.%s\n' "$GREEN" "$RESET"
  return 0
}

case "${1:-}" in
  check)
    banner "Health check — app under test"
    check_app
    ;;

  1)
    banner "STEP 1 — The suite: 28 tests against the running app"
    echo "${DIM}Say: 22 API tests, 6 UI tests. Roughly five seconds.${RESET}"
    pause
    npm test
    ;;

  2)
    banner "STEP 2 — The guardrails: what happens when an agent writes a bad test"
    echo "${DIM}Say: this is the agentic core. Six rules, each targeting a"
    echo "mistake AI agents reliably make. Not documented — enforced.${RESET}"
    pause
    echo "${BOLD}Here is the deliberately bad test:${RESET}"
    echo
    sed -n '17,45p' demo/bad-test-example.spec.ts.txt
    pause
    cp demo/bad-test-example.spec.ts.txt tests/api/demo-bad.spec.ts
    echo "${BOLD}Running the linter against it:${RESET}"
    echo
    npx eslint tests/api/demo-bad.spec.ts
    rm -f tests/api/demo-bad.spec.ts
    echo
    echo "${GREEN}All six rules fired. Each message says what to do instead.${RESET}"
    ;;

  3)
    banner "STEP 3 — One command an agent runs before declaring work done"
    echo "${DIM}Say: typecheck catches invented methods, lint catches the six"
    echo "mistakes, manifest catches stale helper docs, smoke proves it runs.${RESET}"
    pause
    npm run agent:verify
    ;;

  4)
    banner "STEP 4 — The UI tests, in a real browser"
    echo "${DIM}Say: signup, publish an article, post a comment — all real.${RESET}"
    pause
    npm run test:headed
    ;;

  *)
    banner "Interview demo"
    cat <<'EOF'
  ./demo/demo.sh check    Health-check the app        (ALWAYS run this first)
  ./demo/demo.sh 1        Suite passing — 28 tests    (~5s)
  ./demo/demo.sh 2        Guardrails catching a bad test  (~5s)  <- strongest
  ./demo/demo.sh 3        Quality gates               (~15s)
  ./demo/demo.sh 4        UI tests in a visible browser   (~15s)

  Short on time? Run: check, then 2, then 1.
EOF
    ;;
esac
