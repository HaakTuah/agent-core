#!/usr/bin/env bash
# A step's shell with the network cut off, loopback still up (#770): the core's tests workflow gives it to each step of
# its suites on Linux but the part network (.github/workflows/tests.yml, the job's `defaults`), so a test that reaches
# the network fails in that run, on a pull request and on main alike, and says its mend (tasks/tests.md, "A test that
# reaches the network runs once per batch"). A step that must reach the network (an install, a fetch of a tool, the
# lookups in the registry) names `shell: bash`, and the workflow test holds that list.
#
#   shell: bash scripts/offline.sh {0}
#
# The step's script runs as GitHub's own `bash` runs it (bash --noprofile --norc -eo pipefail), as the runner's own user,
# in a network namespace of its own: root makes it and brings its loopback up (sudo, unshare, ip), then gives the script
# to the user who started this (setpriv), with no capability kept nor any to gain (no sudo within), and the environment
# this was started with, saved before sudo and given back whole, since sudo sets its own. A runner without those
# programs, or where the cut fails, fails the step and says so: the script never runs with the network up.
set -u
if [ $# -ne 1 ]; then
  echo "FAIL: scripts/offline.sh takes one script, the step's, and was given $#. Mend: give it as a step's shell, \"bash scripts/offline.sh {0}\"" >&2
  exit 1
fi
script=$1
saved=$(mktemp) cut=$(mktemp) out=$(mktemp)
env -0 > "$saved"
# (the inner shells: as root, the loopback up, the mark that the cut was made, and the user's own; then, as the user, the
# environment given back from what was saved, CORE_OFFLINE set so a test can read that the cut stands, and the script)
# shellcheck disable=SC2016 # (each $ is the inner shell's)
sudo -n unshare --net -- bash --noprofile --norc -c 'ip link set lo up && echo cut > "$3" && exec setpriv --reuid="$4" --regid="$5" --init-groups --no-new-privs -- env -i bash --noprofile --norc -c '\''while IFS= read -r -d "" kv; do export "$kv" 2> /dev/null || true; done < "$1"; rm -f "$1"; export CORE_OFFLINE=1; exec bash --noprofile --norc -eo pipefail "$2"'\'' offline "$1" "$2"' \
  offline "$saved" "$script" "$cut" "$(id -u)" "$(id -g)" 2>&1 | tee "$out"
status=${PIPESTATUS[0]}
rm -f "$saved"
if [ ! -s "$cut" ]; then
  rm -f "$cut"
  echo "::error::FAIL: the network could not be cut off for this step, so its script did not run (scripts/offline.sh, #770: it asks sudo, unshare, setpriv and ip of a Linux runner). Mend: run the job on GitHub's ubuntu runner, which holds them, or, where a runner cannot cut the network, give the step \"shell: bash\" in .github/workflows/tests.yml and add its script to the steps the workflow test holds as reaching the network, saying why"
  rm -f "$out"
  exit 1
fi
rm -f "$cut"
# (a failure whose output shows a fetch the cut refused: no name resolved, as Node, git, curl and .NET each word it, or no
# route)
if [ "$status" -ne 0 ]; then
  seen=$(grep -o -m 1 -E 'EAI_AGAIN|ENOTFOUND|ENETUNREACH|Temporary failure in name resolution|Name or service not known|Could not resolve host|Network is unreachable|Resource temporarily unavailable \([^)]*:[0-9]+\)' "$out" | head -n 1)
  if [ -n "$seen" ]; then
    echo "::error::FAIL: this step reached the network, which its run cuts off: its output shows \"$seen\" (scripts/offline.sh, #770). Mend: make the test fetch from a copy it makes on the machine (a package file, a feed in a folder, a repository read by its path), or, where reaching the network is what it guards, move its step to the part network of .github/workflows/tests.yml (tasks/tests.md, \"A test that reaches the network runs once per batch\")"
  fi
fi
rm -f "$out"
exit "$status"
