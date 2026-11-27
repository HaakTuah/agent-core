// Checks which packages of the machine's distribution the licence scan asks no version (licence-scan.mjs's pinFault;
// #1361, point 11): an entry of kind "distribution" whose package a command of the file installs by its package manager,
// its downloads by address still asked their checksums, a read of a version index among them. The scan's other pin cases
// are licence-scan-pins-test.mjs's. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/licence-distribution-test.mjs
import { done, ok } from "../scripts/licence-scan-stage.mjs";
import { pinFault } from "../scripts/licence-scan.mjs";

const SH = "scripts/setup.sh", sdk = { name: "dotnet-sdk-8.0", licence: "MIT", files: [SH] }, moss = { name: "mosstool", licence: "MIT", version: "1.2.0", files: [SH] };
const APT = "apt-get install -y dotnet-sdk-8.0\n", GET = "curl -fsSLo moss.tgz \"https://mossgrip.example/moss-1.2.0.tgz\"\n";
const CHECKED = `echo "${"0a1b2c3d".repeat(8)}  moss.tgz" | sha256sum -c -\n`;
const bare = pinFault([sdk, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`);
ok(/names no version/u.test(bare?.what ?? "") && /"kind": "distribution"/u.test(bare?.mend ?? ""), "an entry with no version beside a program's download is asked one, its mend naming the distribution's kind");
ok(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`) === null, "and one of kind distribution whose package the file installs is not");
ok(/dotnet-sdk-8\.0, in audit\.json, names no version/u.test(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${GET}${CHECKED}`)?.what ?? ""),
  "one of kind distribution whose package the file installs by no package manager is asked its version (#1455)");
const dist = (code) => pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${code}${GET}${CHECKED}`);
ok(["sudo apt-get install -y dotnet-sdk-8.0\n", "RUN apk add --no-cache dotnet-sdk-8.0\n", "apt-get update && apt-get install -y git dotnet-sdk-8.0\n", "      - run: sudo apt-get install -y dotnet-sdk-8.0\n"].every((c) => dist(c) === null)
  && ["apt-get remove dotnet-sdk-8.0\n", "echo \"brew users: brew install dotnet-sdk-8.0\"\n", "apt-get install -y dotnet-sdk-8.0-extra\n"].every((c) => /names no version/u.test(dist(c)?.what ?? "")),
"an install by a package manager's own command, by sudo, in a RUN, after && or in a workflow's one-line run, counts; a removal, an echo naming one or another package's name does not (#1455)");
ok(/holds no checksum/u.test(pinFault([{ ...sdk, kind: "distribution" }], "audit.json", SH, `${APT}${GET}`)?.what ?? ""), "a download covered by a distribution's package alone is still asked its checksum");
const INDEX = "v=$(curl -q -fsS https://dotnet.example/release-metadata/releases-index.json | jq -r '.[0].sdk' | grep -Ex '[0-9][0-9A-Za-z.+-]*')\n";
ok(/1 checksum and 1 check for 2 downloads/u.test(pinFault([moss], "audit.json", SH, `${INDEX}${GET}${CHECKED}`)?.what ?? ""),
  "a read of a version index is asked its checksum as any download is (#1455's review)");
ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, "curl -o payload.txt https://mossgrip.example/payload.txt\nbash payload.txt\n")?.what ?? ""), "a text file kept and run on a later line is asked its checksum (#1455)");
done();
