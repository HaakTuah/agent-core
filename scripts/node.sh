#!/usr/bin/env bash
# The Node every project's cloud machines run ("Node" in modules/updates.md): a project's cloud setup runs this file
# from its copy of the core on its own `main` (`git show <main>:core/scripts/node.sh`), never a branch's, as it runs
# itself. Where the machine's Node is older than the pin, Node comes from the npm registry, the download host the cloud
# allows: its node-linux-<arch> package holds the official binary, which takes the place of the machine's own node, so
# every shell's PATH finds it; npm stays as it is. No package's install script runs (floor rule 15): the package is
# only fetched (`npm pack`) and its binary taken out, checked against its SHA-256 before it runs, the same binary as in
# nodejs.org's node-v<version>-linux-<arch>.tar.xz, whose SHASUMS256.txt was checked when the pin was set; a new pin
# repeats that. Safe to run twice; always exits 0 and says what it could not do.
NODE_VERSION=26.13.0
have() { command -v "$1" >/dev/null 2>&1; }
if ! have node || ! have npm; then echo "NOT INSTALLED: Node $NODE_VERSION (no node and npm to start from)"; exit 0; fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "${NODE_VERSION%%.*}" ]; then echo "node: $(node -v) present"; exit 0; fi
case "$(uname -m)" in
  x86_64) arch=x64 sum=0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b ;;
  aarch64) arch=arm64 sum=66f4a883c880ef336276e7730c01cbae2b92fb8e6a51f7371f920599cac824b7 ;;
  *) echo "NOT INSTALLED: Node $NODE_VERSION (no pinned binary for $(uname -m))"; exit 0 ;;
esac
dir=$(mktemp -d) && bin=$(readlink -f "$(command -v node)")
if (cd "$dir" && npm pack --silent "node-linux-$arch@$NODE_VERSION" && tar xzf node-linux-*.tgz package/bin/node \
  && echo "$sum  package/bin/node" | sha256sum -c -) >/tmp/node-install.log 2>&1 \
  && cp "$dir/package/bin/node" "$bin.new" && mv "$bin.new" "$bin"; then
  echo "node: $(node -v) installed"
else
  echo "NOT INSTALLED: Node $NODE_VERSION (see /tmp/node-install.log)"
fi
rm -rf "$dir"
exit 0
