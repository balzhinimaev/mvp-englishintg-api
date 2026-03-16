# Cross-service Smoke Check (bot -> mini-app -> backend)

This check verifies the critical integration boundaries:

1. Bot endpoint reachability
2. Mini App reachability
3. Backend health
4. Protected runtime auth behavior (401 without JWT)
5. Runtime lifecycle with JWT (`start -> submit-answer -> end`)

## Run

```bash
cd /opt/mvp-englishintg-api
BASE_URL="https://englishintg.ru" ./scripts/smoke-e2e.sh
```

## Full authenticated flow

Provide a valid user JWT from Mini App auth:

```bash
JWT_TOKEN="<jwt>" \
BASE_URL="https://englishintg.ru" \
MODULE_REF="a0.basics" \
LESSON_REF="a0.basics.001" \
TASK_REF="a0.basics.001.t1" \
./scripts/smoke-e2e.sh
```

## Expected output

- `PASS (partial)` when JWT is missing (public + auth boundary checks only)
- `PASS` when full authenticated flow succeeds

## Notes

- If `submit-answer` returns no `attemptId`, likely selected `TASK_REF` does not match expected payload format for that task type; adjust `TASK_REF`/`userAnswer` accordingly.
- This script is intended as a deployment sanity check and integration boundary detector.
