#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://englishintg.ru}"
BOT_URL="${BOT_URL:-${BASE_URL}/bot/start}"
MINI_APP_URL="${MINI_APP_URL:-${BASE_URL}/}"
JWT_TOKEN="${JWT_TOKEN:-}"
MODULE_REF="${MODULE_REF:-a0.basics}"
LESSON_REF="${LESSON_REF:-a0.basics.001}"
TASK_REF="${TASK_REF:-a0.basics.001.t1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "Required command not found: $1"; exit 1; }
}

http_json() {
  local method="$1" url="$2" body="${3:-}" auth="${4:-}"
  if [[ -n "$body" ]]; then
    if [[ -n "$auth" ]]; then
      curl -sS -X "$method" "$url" -H "Content-Type: application/json" -H "Authorization: Bearer $auth" -d "$body"
    else
      curl -sS -X "$method" "$url" -H "Content-Type: application/json" -d "$body"
    fi
  else
    if [[ -n "$auth" ]]; then
      curl -sS -X "$method" "$url" -H "Authorization: Bearer $auth"
    else
      curl -sS -X "$method" "$url"
    fi
  fi
}

status_code() {
  local method="$1" url="$2" auth="${3:-}"
  if [[ -n "$auth" ]]; then
    curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $auth"
  else
    curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url"
  fi
}

extract_json_field() {
  local field="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); const v=j['$field']; if(v===undefined||v===null){process.exit(2)}; process.stdout.write(String(v));}catch(e){process.exit(1)}})"
}

main() {
  require_cmd curl
  require_cmd node

  echo "== Smoke E2E (bot -> mini-app -> backend) =="
  echo "BASE_URL=$BASE_URL"
  echo "BOT_URL=$BOT_URL"
  echo "MINI_APP_URL=$MINI_APP_URL"

  # 1) Bot reachability
  code=$(status_code GET "$BOT_URL")
  if [[ "$code" == "200" || "$code" == "302" || "$code" == "404" || "$code" == "405" ]]; then
    ok "Bot endpoint reachable (HTTP $code): $BOT_URL"
  else
    err "Bot endpoint failed (HTTP $code): $BOT_URL"
    exit 1
  fi

  # 2) Mini app reachability
  code=$(status_code GET "$MINI_APP_URL")
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" ]]; then
    ok "Mini app reachable (HTTP $code): $MINI_APP_URL"
  else
    err "Mini app failed (HTTP $code): $MINI_APP_URL"
    exit 1
  fi

  # 3) Backend health
  code=$(status_code GET "$BASE_URL/health")
  if [[ "$code" == "200" ]]; then
    ok "Backend health OK"
  else
    err "Backend health failed (HTTP $code)"
    exit 1
  fi

  # 4) Protected endpoint should reject without JWT
  code=$(status_code POST "$BASE_URL/api/progress/sessions/start")
  if [[ "$code" == "401" ]]; then
    ok "Protected endpoint rejects anonymous requests (401)"
  else
    err "Expected 401 without JWT, got $code"
    exit 1
  fi

  if [[ -z "$JWT_TOKEN" ]]; then
    warn "JWT_TOKEN not provided; skipping authenticated runtime flow checks"
    echo "PASS (partial)"
    exit 0
  fi

  # 5) Start session
  start_body="{\"moduleRef\":\"$MODULE_REF\",\"lessonRef\":\"$LESSON_REF\",\"source\":\"home\"}"
  start_resp=$(http_json POST "$BASE_URL/api/progress/sessions/start" "$start_body" "$JWT_TOKEN")
  session_id=$(printf '%s' "$start_resp" | extract_json_field sessionId || true)
  if [[ -z "$session_id" ]]; then
    err "Failed to start session. Response: $start_resp"
    exit 1
  fi
  ok "Session started: $session_id"

  # 6) Submit answer
  idem="smoke-$(date +%s)"
  submit_body="{\"lessonRef\":\"$LESSON_REF\",\"taskRef\":\"$TASK_REF\",\"userAnswer\":\"[]\",\"durationMs\":500,\"sessionId\":\"$session_id\",\"isLastTask\":false}"
  submit_resp=$(curl -sS -X POST "$BASE_URL/api/progress/submit-answer" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Idempotency-Key: $idem" \
    -d "$submit_body")

  attempt_id=$(printf '%s' "$submit_resp" | extract_json_field attemptId || true)
  if [[ -z "$attempt_id" ]]; then
    warn "submit-answer did not return attemptId (may be task payload mismatch for chosen TASK_REF). Response: $submit_resp"
  else
    ok "Answer submitted: $attempt_id"
  fi

  # 7) End session
  end_resp=$(http_json POST "$BASE_URL/api/progress/sessions/$session_id/end" '{"extraXp":0}' "$JWT_TOKEN")
  end_ok=$(printf '%s' "$end_resp" | extract_json_field ok || true)
  if [[ "$end_ok" == "true" ]]; then
    ok "Session ended"
  else
    err "Failed to end session. Response: $end_resp"
    exit 1
  fi

  echo "PASS"
}

main "$@"
