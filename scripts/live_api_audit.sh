#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://balanced-peace-backend.up.railway.app}"
TMP_DIR="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

trap 'rm -rf "${TMP_DIR}"' EXIT

json_snippet() {
  local body_file="$1"
  if command -v jq >/dev/null 2>&1 && jq -e . "${body_file}" >/dev/null 2>&1; then
    jq -c . "${body_file}" | cut -c1-220
    return
  fi

  tr '\n' ' ' < "${body_file}" | sed 's/[[:space:]]\+/ /g' | cut -c1-220
}

probe() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  local expected_json_expr="$4"
  local label="$5"
  local body="${6-}"
  local extra_header_name="${7-}"
  local extra_header_value="${8-}"

  local body_file="${TMP_DIR}/body-$(printf '%s' "${label}" | tr ' /:' '___').txt"
  local status=""
  local curl_args=(
    -sS
    --max-time 20
    -X "${method}"
    -H "Accept: application/json"
    -o "${body_file}"
    -w "%{http_code}"
  )

  if [[ -n "${extra_header_name}" ]]; then
    curl_args+=(-H "${extra_header_name}: ${extra_header_value}")
  fi

  if [[ -n "${body}" ]]; then
    curl_args+=(-H "Content-Type: application/json" --data "${body}")
  fi

  if ! status="$(curl "${curl_args[@]}" "${BASE_URL}${path}")"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf 'FAIL | %-38s | curl-error | %s %s\n' "${label}" "${method}" "${path}"
    return
  fi

  if [[ "${status}" != "${expected_status}" ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf 'FAIL | %-38s | status=%s expected=%s | %s\n' "${label}" "${status}" "${expected_status}" "$(json_snippet "${body_file}")"
    return
  fi

  if [[ -n "${expected_json_expr}" ]]; then
    if ! jq -e "${expected_json_expr}" "${body_file}" >/dev/null 2>&1; then
      FAIL_COUNT=$((FAIL_COUNT + 1))
      printf 'FAIL | %-38s | body-check | %s\n' "${label}" "$(json_snippet "${body_file}")"
      return
    fi
  fi

  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS | %-38s | status=%s | %s\n' "${label}" "${status}" "$(json_snippet "${body_file}")"
}

echo "== Public endpoints =="
probe GET  "/api/v1/health"                              200 '.ok == true and .env == "production" and .chainId == "lendpay-4" and .mode == "preview"' 'health'
probe GET  "/api/v1/meta/connect-feeds"                  200 '.feeds | type == "array"'                                                         'meta connect feeds'
probe GET  "/api/v1/meta/treasury"                       200 '.mode == "preview" and .canBroadcast == false'                                     'meta treasury'
probe GET  "/api/v1/meta/ai"                             200 '.available == true and (.configuredProvider == "heuristic" or .activeProvider == "heuristic")' 'meta ai'
probe GET  "/api/v1/meta/metrics"                        200 ''                                                                                   'meta metrics'
probe GET  "/api/v1/meta/chains"                         200 '.rollupChainId == "lendpay-4"'                                                     'meta chains'
probe GET  "/indexer/tx/v1/txs/by_account/init1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqnrql8a" 200 '.txs | type == "array"'                        'indexer tx by account'
probe GET  "/indexer/nft/v1/tokens/by_account/init1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqnrql8a" 200 '.tokens | type == "array"'                 'indexer nft by account'
probe GET  "/api/v1/protocol/campaigns"                  200 'type == "array"'                                                                   'protocol campaigns get'
probe GET  "/api/v1/protocol/governance"                 200 'type == "array"'                                                                   'protocol governance get'
probe GET  "/api/v1/protocol/merchants"                  200 'type == "array"'                                                                   'protocol merchants get'
probe GET  "/api/v1/protocol/tx/test-hash"               200 '. == null'                                                                         'protocol tx get'
probe GET  "/api/v1/protocol/viral-drop/items"           200 'type == "array"'                                                                   'protocol viral-drop items'
probe GET  "/api/v1/protocol/viral-drop/purchases"       200 'type == "array"'                                                                   'protocol viral-drop purchases'
probe POST "/api/v1/auth/challenge"                      400 '.code == "VALIDATION_ERROR"'                                                       'auth challenge invalid' '{}'
probe POST "/api/v1/auth/challenge"                      200 '.challengeId != null and .message != null and .expiresAt != null'                 'auth challenge valid' '{"address":"init1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqnrql8a"}'
probe POST "/api/v1/auth/verify"                         400 '.code == "VALIDATION_ERROR"'                                                       'auth verify missing fields' '{}'

echo
echo "== Bearer-protected endpoints (expect 401) =="
probe POST "/api/v1/auth/refresh"                        401 '.code == "UNAUTHORIZED"'                                                           'auth refresh unauth'
probe POST "/api/v1/auth/logout"                         401 '.code == "UNAUTHORIZED"'                                                           'auth logout unauth'
probe GET  "/api/v1/me"                                  401 '.code == "UNAUTHORIZED"'                                                           'me unauth'
probe GET  "/api/v1/me/username"                         401 '.code == "UNAUTHORIZED"'                                                           'me username unauth'
probe POST "/api/v1/me/username/refresh"                 401 '.code == "UNAUTHORIZED"'                                                           'me username refresh unauth' '{}'
probe GET  "/api/v1/me/points"                           401 '.code == "UNAUTHORIZED"'                                                           'me points unauth'
probe POST "/api/v1/me/rewards/sync"                     401 '.code == "UNAUTHORIZED"'                                                           'me rewards sync unauth' '{}'
probe GET  "/api/v1/me/activity"                         401 '.code == "UNAUTHORIZED"'                                                           'me activity unauth'
probe GET  "/api/v1/me/faucet"                           401 '.code == "UNAUTHORIZED"'                                                           'me faucet unauth'
probe POST "/api/v1/me/faucet/claim"                     401 '.code == "UNAUTHORIZED"'                                                           'me faucet claim unauth' '{}'
probe GET  "/api/v1/me/referral"                         401 '.code == "UNAUTHORIZED"'                                                           'me referral unauth'
probe POST "/api/v1/me/referral/apply"                   401 '.code == "UNAUTHORIZED"'                                                           'me referral apply unauth' '{}'
probe GET  "/api/v1/leaderboard"                         401 '.code == "UNAUTHORIZED"'                                                           'leaderboard unauth'
probe GET  "/api/v1/score"                               401 '.code == "UNAUTHORIZED"'                                                           'score unauth'
probe POST "/api/v1/score/analyze"                       401 '.code == "UNAUTHORIZED"'                                                           'score analyze unauth' '{}'
probe GET  "/api/v1/score/history"                       401 '.code == "UNAUTHORIZED"'                                                           'score history unauth'
probe GET  "/api/v1/agent/guide"                         401 '.code == "UNAUTHORIZED"'                                                           'agent guide get unauth'
probe POST "/api/v1/agent/guide"                         401 '.code == "UNAUTHORIZED"'                                                           'agent guide post unauth' '{}'
probe GET  "/api/v1/loan-requests"                       401 '.code == "UNAUTHORIZED"'                                                           'loan requests list unauth'
probe POST "/api/v1/loan-requests"                       401 '.code == "UNAUTHORIZED"'                                                           'loan requests create unauth' '{}'
probe GET  "/api/v1/loan-requests/test-id"               401 '.code == "UNAUTHORIZED"'                                                           'loan request get unauth'
probe POST "/api/v1/loan-requests/test-id/review-demo"   401 '.code == "UNAUTHORIZED"'                                                           'loan request review demo unauth' '{}'
probe GET  "/api/v1/loans"                               401 '.code == "UNAUTHORIZED"'                                                           'loans list unauth'
probe GET  "/api/v1/loans/test-id"                       401 '.code == "UNAUTHORIZED"'                                                           'loan get unauth'
probe GET  "/api/v1/loans/test-id/schedule"              401 '.code == "UNAUTHORIZED"'                                                           'loan schedule unauth'
probe GET  "/api/v1/loans/test-id/fees"                  401 '.code == "UNAUTHORIZED"'                                                           'loan fees unauth'
probe POST "/api/v1/loans/test-id/repay"                 401 '.code == "UNAUTHORIZED"'                                                           'loan repay unauth' '{}'
probe GET  "/api/v1/protocol/profiles"                   401 '.code == "UNAUTHORIZED"'                                                           'protocol profiles unauth'
probe GET  "/api/v1/protocol/liquidity/lend"             401 '.code == "UNAUTHORIZED"'                                                           'protocol liquidity unauth'

echo
echo "== Operator-protected endpoints (expect 401) =="
probe POST "/api/v1/loan-requests/test-id/approve"       401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'loan approve no operator' '{}'
probe POST "/api/v1/protocol/campaigns"                  401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'protocol campaigns post no operator' '{}'
probe POST "/api/v1/protocol/campaigns/test-id/allocations" 401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                            'protocol campaign alloc no operator' '{}'
probe POST "/api/v1/protocol/campaigns/test-id/close"    401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'protocol campaign close no operator' '{}'
probe POST "/api/v1/protocol/governance/proposals"       401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'protocol governance propose no operator' '{}'
probe POST "/api/v1/protocol/governance/test-id/vote"    401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'protocol governance vote no operator' '{}'
probe POST "/api/v1/protocol/governance/test-id/finalize" 401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                              'protocol governance finalize no operator' '{}'
probe POST "/api/v1/protocol/merchants"                  401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'protocol merchants post no operator' '{}'
probe POST "/api/v1/protocol/merchants/test-id/active"   401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'protocol merchants active no operator' '{}'
probe POST "/api/v1/admin/vip/stages/test/publish"       401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'admin vip publish no operator' '{}'
probe POST "/api/v1/admin/vip/stages/test/finalize"      401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'admin vip finalize no operator' '{}'
probe POST "/api/v1/admin/dex/simulate"                  401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'admin dex simulate no operator' '{}'
probe POST "/api/v1/admin/dex/rebalance"                 401 '.code == "OPERATOR_TOKEN_REQUIRED"'                                                'admin dex rebalance no operator' '{}'
probe POST "/api/v1/admin/dex/simulate"                  401 '.code == "OPERATOR_UNAUTHORIZED"'                                                  'admin dex invalid operator' '{}' 'X-Operator-Token' 'invalid-token'

echo
echo "== Summary =="
printf 'PASS=%d FAIL=%d TOTAL=%d\n' "${PASS_COUNT}" "${FAIL_COUNT}" "$((PASS_COUNT + FAIL_COUNT))"

if [[ "${FAIL_COUNT}" -ne 0 ]]; then
  exit 1
fi
