#!/usr/bin/env bash
set -euo pipefail

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
export PATH="$PG_BIN:$PATH"
DB_NAME="${FORM_HEMA_022_TEST_DB:-hematology_form_hema_022_test}"
STUDY_ID="44444444-4444-4444-4444-444444444444"
USER_C="cccccccc-cccc-cccc-cccc-cccccccccccc"
ITEM_NEW="eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<SQL
INSERT INTO public.inventory_reagent_lot_comparisons (
  id, study_number, status, reagent_name, old_lot_number, new_lot_number,
  new_store_item_id, schema_version, acceptance_criteria_configured, created_by,
  prepared_by, reviewed_by, approved_by, test_parameter
) VALUES (
  '$STUDY_ID', 'RLT-TEST-CONCURRENT', 'approved', 'NeoPTimal', 'OLD-LOT-C', 'NEW-LOT-1',
  '$ITEM_NEW', 2, TRUE, '$USER_C', '$USER_C', '$USER_C', '$USER_C', 'CONCURRENT'
) ON CONFLICT (id) DO UPDATE SET status = 'approved', activated_at = NULL, activated_by = NULL, new_store_item_id = '$ITEM_NEW';

DELETE FROM public.inventory_lot_usage WHERE reagent_comparison_id = '$STUDY_ID';
SQL

run_activation() {
  psql -At -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE v_usage UUID;
BEGIN
  PERFORM set_config('app.test_user_id', '$USER_C', true);
  v_usage := public.activate_reagent_lot_study('$STUDY_ID'::uuid);
  RAISE NOTICE 'USAGE:%', v_usage;
END \$\$;
SQL
}

tmp1="$(mktemp)"
tmp2="$(mktemp)"
run_activation >"$tmp1" 2>&1 &
pid1=$!
sleep 0.05
run_activation >"$tmp2" 2>&1 &
pid2=$!
wait "$pid1" || true
wait "$pid2" || true

success_count=0
blocked_count=0
for f in "$tmp1" "$tmp2"; do
  if rg -q "already activated" "$f"; then
    blocked_count=$((blocked_count + 1))
    echo "Concurrent retry blocked as expected"
  elif rg -q "USAGE:[0-9a-f-]{36}" "$f"; then
    success_count=$((success_count + 1))
    echo "Concurrent activation succeeded once"
  else
    echo "Unexpected concurrent activation output:" >&2
    cat "$f" >&2
    exit 1
  fi
done

if [[ "$success_count" -ne 1 || "$blocked_count" -ne 1 ]]; then
  echo "Expected one success and one blocked retry, got success=$success_count blocked=$blocked_count" >&2
  exit 1
fi

active_count="$(psql -At -d "$DB_NAME" -c "SELECT count(*) FROM public.inventory_lot_usage WHERE reagent_comparison_id = '$STUDY_ID' AND status = 'active';")"
if [[ "$active_count" != "1" ]]; then
  echo "Expected one active lot usage, found $active_count" >&2
  exit 1
fi

echo "PASS concurrent activation serialized to one success and one retry block"
