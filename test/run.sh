#!/bin/bash
# 2.23: runs every suite and fails if any of them prints FAIL, a page error, or exits non-zero. (The suites print FAIL lines
# but most exit 0 regardless, which is how v27_ui went on failing unnoticed after 2.19.) Needs the dev server on :8765:
#   cd assets && python3 -m http.server 8765 &
# Usage: test/run.sh [suite ...]      Logs go to /tmp/tr/<suite>.log; a summary prints at the end.
cd "$(dirname "$0")/.." || exit 2
SUITES="${*:-people_logic oracle_logic oracle_ui interp_java people_ui remind_logic overdue_java remind_ui town_logic townmap_ui life_ui spar_ui plan_ui town_ui events crawl_trace dungeon_map rooms v27_ui v28_ui touch_ui hearth_ui estate_ui build_ui companion_ui delve_ui crawl_ui crawl_story crawl_themes herald_ui omens items_ui finish_ui bestiary_ui end_ui}"
mkdir -p /tmp/tr
if ! curl -s -o /dev/null http://localhost:8765/index.html; then echo "dev server not running on :8765"; exit 2; fi
bad=0; summary=""
for t in $SUITES; do
  TZ=Australia/Perth timeout 170 node "test/$t.js" > "/tmp/tr/$t.log" 2>&1; code=$?
  fails=$(grep -cE '^FAIL|PAGEERROR|[0-9]+ FAILED' "/tmp/tr/$t.log")
  if [ "$code" != "0" ] || [ "$fails" != "0" ]; then bad=$((bad + 1)); summary="$summary\n  ✗ $t (exit $code, $fails failing lines)"; else summary="$summary\n  ✓ $t"; fi
  echo "$t exit $code fails $fails" >> /tmp/tr/_done.log
done
echo -e "$summary"
echo ALLDONE >> /tmp/tr/_done.log
if [ "$bad" != "0" ]; then echo "$bad suite(s) failed"; exit 1; fi
echo "all suites passed"
