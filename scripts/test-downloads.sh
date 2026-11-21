#!/usr/bin/env bash
# What the core's tests workflow downloads while the network is up, for tests that run with it cut off (.github/workflows/tests.yml,
# scripts/offline.sh; #772), each as a file kept under the runner's temporary folder, outside the repository, and never run
# here. Run by the job's set-up step, from the repository's root, naming one:
#
#   bash scripts/test-downloads.sh wheels >> "$GITHUB_ENV"     the wheels of .packages/requirements.txt (the code scan's
#                                                                engine, zizmor), each held to its SHA-256 there by pip
#                                                                (--require-hashes); prints CORE_WHEELS=<folder>
#   bash scripts/test-downloads.sh archives >> "$GITHUB_ENV"   Betterleaks' release for Linux x64, at the version and the
#                                                                archive's SHA-256 that .github/workflows/personal-terms.yml
#                                                                pins for it (tests/workflows-test.mjs holds the two
#                                                                together), checked here before the folder is passed on;
#                                                                prints CORE_ARCHIVES=<folder>
#
# What a download prints goes to the error output, so that the standard output holds the one line for GITHUB_ENV. Where a
# download fails, or its checksum differs, it says so on the error output, prints nothing and still exits 0, and the tests
# that needed it then fail saying their own mend (the code scan's and the personal-terms tests name the step), never
# passing unread. Always exits 0, as scripts/lychee.sh does.
temp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
case "${1:-}" in
  wheels)
    if (python3 -I -m pip download --require-hashes --no-deps --only-binary=:all: --no-input --disable-pip-version-check -r .packages/requirements.txt -d "$temp/wheels" >&2); then
      echo "CORE_WHEELS=$temp/wheels"
    else
      echo "The wheels of .packages/requirements.txt were not fetched: pip's download failed or a wheel differs from its SHA-256." >&2
    fi
    ;;
  archives)
    version=1.10.1 sum=c174b42d7aa60caf58c0c3e555c0e4bed01fe6b0d99a412bce777b5af4ce913e
    file="betterleaks_${version}_linux_x64.tar.gz"
    if (set -e; mkdir -p "$temp/archives"
        curl -fsSL --proto =https --proto-redir =https --connect-timeout 30 --max-time 300 --retry 2 -o "$temp/archives/$file" "https://github.com/betterleaks/betterleaks/releases/download/v$version/$file" >&2
        echo "$sum  $temp/archives/$file" | sha256sum -c - >&2); then
      echo "CORE_ARCHIVES=$temp/archives"
    else
      rm -rf "$temp/archives"
      echo "Betterleaks $version's archive was not fetched: the download failed or the archive differs from its SHA-256." >&2
    fi
    ;;
  *)
    echo "scripts/test-downloads.sh takes wheels or archives and was given \"${1:-}\"; it fetched nothing." >&2
    ;;
esac
