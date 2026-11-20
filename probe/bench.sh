#!/bin/bash
# timings of what the tests do most, on this runner
t() { local s=$(date +%s%N); "$@" >/dev/null 2>&1; echo $(( ($(date +%s%N) - s) / 1000000 )); }
W=$RUNNER_TEMP/bench; rm -rf "$W"; mkdir -p "$W"; cd "$W"
git config --global user.email t@e.invalid; git config --global user.name t
git clone -q --bare --no-hardlinks "$GITHUB_WORKSPACE" b.git
echo "files: $(git --git-dir=b.git ls-tree -r HEAD | wc -l)"
echo "git version call x10 (spawn cost), ms total: $(t bash -c 'for i in 1 2 3 4 5 6 7 8 9 10; do git --version; done')"
for w in 1 0 1 0; do
  rm -rf w; git clone -q --no-checkout "file:///$(cygpath -m "$W")/b.git" w
  echo "checkout workers=$w: $(t git -C w -c checkout.workers=$w checkout -q --detach HEAD) ms"
done
cd w
echo "add -A (nothing changed): $(t git add -A) ms"
echo "add -A again: $(t git add -A) ms"
echo "status: $(t git status -s) ms"
echo "status fsmonitor off+untrackedcache: $(t git -c core.untrackedCache=true status -s) ms"
cd "$W"; rm -rf c; mkdir c; cd c; git init -q; cp -r "$GITHUB_WORKSPACE/scripts" .
echo "cp -r scripts files: $(find . -type f -not -path './.git/*' | wc -l)"
echo "first add -A: $(t git add -A) ms"; echo "commit: $(t git commit -qm x) ms"
cd "$W"; rm -rf c2; git clone -q "$W/c" c2
echo "clone local path (hardlinks) of that: ok"
cd "$W"; rm -rf d; cp -r "$W/w" d
echo "cp -r checkout (1300 files): $(t cp -r "$W/w" "$W/d2") ms"

echo "--- where: default temp (C:) vs runner temp (D:)"
for base in "$RUNNER_TEMP" "$(cygpath -u "$LOCALAPPDATA")/Temp"; do
  echo "base $base"
  cd "$base"; rm -rf bb; mkdir bb; cd bb
  git clone -q --bare --no-hardlinks "$GITHUB_WORKSPACE" b.git
  U="file:///$(cygpath -m "$PWD")/b.git"; P="$(cygpath -m "$PWD")/b.git"
  echo " clone --no-checkout file:// : $(t git clone -q --no-checkout "$U" w1) ms"
  echo " clone --no-checkout path   : $(t git clone -q --no-checkout "$P" w2) ms"
  echo " clone --no-checkout --shared: $(t git clone -q --no-checkout --shared "$P" w3) ms"
  echo " checkout w1: $(t git -C w1 checkout -q --detach HEAD) ms"
  echo " checkout w2: $(t git -C w2 checkout -q --detach HEAD) ms"
  echo " bare --no-hardlinks of w1: $(t git clone -q --bare --no-hardlinks "$(cygpath -m "$PWD")/w1" bw) ms"
  echo " add -A in w1: $(t git -C w1 add -A) ms"
done
