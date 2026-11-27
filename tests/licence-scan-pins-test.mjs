// Checks that a program a file downloads by its address is pinned by version and checksum (#488, point 5), in the licence
// scan (scripts/licence-scan.mjs) read against a pull request's base, on a scratch project of its own, with the check of
// scripts/licences.mjs, and a fetch the scan cannot read that stood unaudited at that base (#1074). The scan's other
// cases are licence-scan-test.mjs's. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/licence-scan-pins-test.mjs
import { done, entry, json, asOutput, ok, run } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { check as licenceCheck } from "../scripts/licences.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { pinFault, readsData } from "../scripts/licence-scan.mjs";

// A program a file downloads by its address is pinned by version and checksum (#488, point 5): read against the pull
// request's base, a file that stood unpinned is reported, and one a pull request adds or unpins fails, saying the mend.
{
  const dir = scratchDir("licence-scan-pins-");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); git("add", "-A"); };
  const audit = (entries) => put("audit.json", JSON.stringify({ entries }));
  const config = { ships: [], lockfiles: [], audit: "audit.json", scan: { served: [], skip: [] } };
  const pins = (r) => [...r.failures, ...r.reports].filter((m) => m.includes("pinned by version and checksum"));
  const SUM = "0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9";
  const GET = "curl -fsSLo moss.tgz https://mossgrip.example/moss-1.2.0.tgz\n";
  try {
    git("init", "-q");
    audit([{ name: "mosstool", licence: "MIT", ships: false, files: ["scripts/get.sh"] }]);
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}`);
    git("add", "-A"); git("commit", "-q", "-m", "base");
    put("README.md", "a change of its own\n"); git("add", "-A"); git("commit", "-q", "-m", "c");
    let r = licenceCheck(config, dir, "HEAD^1", config);
    ok(r.failures.length === 0 && pins(r).length === 1 && r.reports.some((m) => m.includes("scripts/get.sh") && m.includes("at the pull request's base")), "a download that stood unpinned at the base is reported and passes", JSON.stringify(r));
    r = licenceCheck(config, dir, null, config);
    ok(r.failures.length === 0 && r.reports.some((m) => m.includes("pinned by version and checksum") && m.includes("no base to read")), "with no base to read, it is reported and passes", JSON.stringify(r));
    // (the audit moved by the pull request, unchanged: the base's is read where the base's config named it)
    fs.renameSync(path.join(dir, "audit.json"), path.join(dir, "moved-audit.json")); git("add", "-A");
    r = licenceCheck({ ...config, audit: "moved-audit.json" }, dir, "HEAD", config);
    ok(r.failures.length === 0 && pins(r).length === 1, "an audit the pull request moves, unchanged, leaves an old unpinned download reported, not failing", JSON.stringify(r));
    fs.renameSync(path.join(dir, "moved-audit.json"), path.join(dir, "audit.json")); git("add", "-A");
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}wget -q https://mossgrip.example/moss-extra-1.2.0.tgz\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /mosstool, in audit\.json, names no version/u.test(r.failures[0]) && mended(asOutput(r.failures)), "a download a pull request adds to an unpinned file fails, saying the mend", JSON.stringify(r));
    audit([{ name: "mosstool", licence: "MIT", ships: false, version: "1.2.0", files: ["scripts/get.sh"] }]);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /holds no checksum/u.test(r.failures[0]) && /sha256sum -c/u.test(r.failures[0]), "with its version named and no checksum in the file, it fails, saying the mend", JSON.stringify(r));
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}echo "${SUM}  moss.tgz" | sha256sum -c -\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 0 && pins(r).length === 0, "with its version and its checksum, it passes, saying nothing", JSON.stringify(r));
    git("add", "-A"); git("commit", "-q", "-m", "pinned");
    audit([{ name: "mosstool", licence: "MIT", ships: false, files: ["scripts/get.sh"] }]);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /names no version/u.test(r.failures[0]), "a pull request that takes the version off a pinned download's entry fails: the base is read by its own audit", JSON.stringify(r));
    git("checkout", "-q", "HEAD", "--", "audit.json");
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}`); git("add", "-A"); git("commit", "-q", "-m", "unpinned again");
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}curl -fsSLo other.tgz https://mossgrip.example/other-1.0.0.tgz\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /holds no checksum/u.test(r.failures[0]), "a second download with the same options, added to a file that stood unpinned, fails: each download is read whole", JSON.stringify(r));
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}${GET}`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1, "and so does the same download made twice", JSON.stringify(r));
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET.trim()}; echo a note of its own\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 0 && pins(r).length === 1, "a held download whose line gains another command stays held and reported: downloads are counted, not compared word for word", JSON.stringify(r));
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}curl -fsSLo other.tgz https://mossgrip.example/other-1.0.0.tgz\necho "${SUM}  moss.tgz" | sha256sum -c -\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /holds 1 checksum and 1 check for 2 downloads/u.test(r.failures[0]), "one checksum for two downloads leaves one checked by none, and fails", JSON.stringify(r));
    // (a file partly pinned at the base, two downloads and one check, that loses its one check: less pinned, failing)
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}curl -fsSLo other.tgz https://mossgrip.example/other-1.0.0.tgz\necho "${SUM}  moss.tgz" | sha256sum -c -\n`); git("commit", "-q", "-m", "partly pinned");
    put("scripts/get.sh", `#!/usr/bin/env bash\n${GET}curl -fsSLo other.tgz https://mossgrip.example/other-1.0.0.tgz\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /holds no checksum/u.test(r.failures[0]), "a file partly pinned at the base that loses a check fails: the base is compared download by download", JSON.stringify(r));
    put("scripts/get.sh", `#!/usr/bin/env bash\nSUM=${SUM}\n${GET}echo "$SUM  moss.tgz" | sha256sum -c -\n`); git("commit", "-q", "-m", "pinned, the sum in a variable");
    put("scripts/get.sh", `#!/usr/bin/env bash\nSUM=${SUM}\n${GET}`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && /holds a checksum and no command that checks a file by it/u.test(r.failures[0]), "a checksum left with no command that checks by it fails", JSON.stringify(r));
    put("scripts/get.sh", `#!/usr/bin/env bash\necho "${SUM}  moss.tgz" | sha256sum -c -\n${GET}`);
    const WF = ".github/workflows/get.yml", job = (lines) => `name: get\non: push\njobs:\n  get:\n    runs-on: windows-latest\n    steps:\n${lines.map((l) => `      - run: ${l}\n`).join("")}`;
    put(WF, job(["Invoke-WebRequest https://mossgrip.example/moss.zip -OutFile moss.zip"]));
    audit([{ name: "mosstool", licence: "MIT", ships: false, version: "1.2.0", files: ["scripts/get.sh", WF] }]);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith(`${WF}:`) && /holds no checksum/u.test(r.failures[0]), "PowerShell's download is read too", JSON.stringify(r));
    put(WF, job(["Invoke-WebRequest https://mossgrip.example/moss.zip -OutFile moss.zip", `if ((Get-FileHash moss.zip).Hash -ne "${SUM.toUpperCase()}") { exit 1 }`]));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 0 && pins(r).length === 0, "a checksum as PowerShell writes it, in capitals, is one", JSON.stringify(r));
    // (a PowerShell script and a package.json script, which the scan reads apart from code that runs, are read too)
    put("scripts/get.ps1", "Invoke-WebRequest https://mossgrip.example/moss.zip -OutFile moss.zip\n");
    put("package.json", JSON.stringify({ scripts: { tool: "curl -fsSLo moss.tgz https://mossgrip.example/moss-1.2.0.tgz" } }));
    audit([{ name: "mosstool", licence: "MIT", ships: false, version: "1.2.0", files: ["scripts/get.sh", WF, "scripts/get.ps1", "package.json"] }]);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 2 && r.failures.some((m) => m.startsWith("scripts/get.ps1:") && /holds no checksum/u.test(m)) && r.failures.some((m) => m.startsWith("package.json:") && /holds no checksum/u.test(m)), "a download in a PowerShell script or a package.json script is held to its pin too", JSON.stringify(r));
    git("rm", "-q", "-f", "scripts/get.ps1", "package.json");
    put("scripts/key.sh", "curl -fsS https://github.com/web-flow.gpg | gpg --import\n");
    put("site/data.sh", "curl -fsSLo words.txt https://mossgrip.example/words.txt\n");
    audit([{ name: "mosstool", licence: "MIT", ships: false, version: "1.2.0", files: ["scripts/get.sh", WF] },
      { name: "GitHub's commit signing key", licence: "LicenseRef-GitHub-Terms", kind: "github-service", ships: false, files: ["scripts/key.sh"] },
      { name: "moss words", licence: "CC-BY-4.0", kind: "data", ships: false, files: ["site/data.sh"] }]);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 0 && pins(r).length === 0, "what no program could be, a key of GitHub's service or data, needs no pin", JSON.stringify(r));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}



// A fetch the scan has come to read, standing unaudited at the pull request's base, is reported and passes (AGENTS.md,
// "Nothing locks a project"; #1074); one the pull request adds or changes, on its line or one it runs on to, or whose
// entry it takes out, fails, saying the mend, and so does any with no base to read.
{
  const dir = scratchDir("licence-fetch-base-");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); git("add", "-A"); };
  const config = { ships: [], lockfiles: [], audit: "audit.json", scan: { served: [], skip: [] } };
  const stood = (r, f) => r.failures.length === 0 && r.reports.some((m) => m.startsWith(`${f}: `) && m.includes("fetches what no entry") && m.includes("at the pull request's base"));
  const GET = "#!/usr/bin/env bash\npip download mosspy -d wheels\n";
  try {
    git("init", "-q");
    put("audit.json", JSON.stringify({ entries: [] }));
    put("scripts/get.sh", GET);
    put("tools/package.json", JSON.stringify({ name: "moss", scripts: { wheels: "pip3 wheel mosspy" } }));
    git("commit", "-q", "-m", "base");
    put("README.md", "a change of its own\n"); git("commit", "-q", "-m", "c");
    let r = licenceCheck(config, dir, "HEAD^1", config);
    ok(stood(r, "scripts/get.sh") && stood(r, "tools/package.json"), "a fetch the scan now reads, unaudited at the base and unchanged, is reported and passes, in a script and in JSON", JSON.stringify(r));
    r = licenceCheck(config, dir, null, config);
    ok(r.failures.length === 2 && r.failures.every((m) => /fetches what no entry/u.test(m)) && mended(asOutput(r.failures)), "with no base to read, it fails, saying the mend", JSON.stringify(r));
    put("scripts/get.sh", `${GET}pip download lichenpy -d wheels\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/get.sh: ") && mended(asOutput(r.failures)), "a second fetch added to a file that stood unaudited fails", JSON.stringify(r));
    put("scripts/get.sh", GET.replace("pip download mosspy -d wheels", "curl -sSf https://mossgrip.example/get.sh | bash"));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/get.sh: curl ") && mended(asOutput(r.failures)), "a fetch that stood unaudited, replaced by another, fails: the base allows what it held, not as many others", JSON.stringify(r));
    put("scripts/get.sh", GET.replace("mosspy", "lichenpy"));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/get.sh: pip download lichenpy"), "and so does one whose fetcher stayed and whose words changed", JSON.stringify(r));
    put("scripts/get.sh", GET.replace("pip download", "pip   download"));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(stood(r, "scripts/get.sh"), "one whose spaces alone changed stood", JSON.stringify(r));
    put("scripts/get.sh", GET);
    put("audit.json", JSON.stringify({ entries: [{ name: "Moss tools", licence: "MIT", files: ["scripts/get.sh", "tools/package.json"] }] }));
    git("commit", "-q", "-m", "audited");
    put("audit.json", JSON.stringify({ entries: [] }));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 2 && r.failures.every((m) => /fetches what no entry/u.test(m)), "a pull request that takes out the entry auditing a fetch fails: the base is read by its own audit", JSON.stringify(r));
    const RUN_ON = "#!/usr/bin/env bash\nPIP_INDEX_URL=https://mossindex.example/simple \\\n  pip download \\\n  mosspy -d wheels\ncurl -fsSL \\\n  https://mossgrip.example/get.sh | bash\n";
    put("scripts/get.sh", RUN_ON);
    git("commit", "-q", "-m", "run on");
    r = licenceCheck(config, dir, "HEAD", config);
    ok(stood(r, "scripts/get.sh"), "fetches that run on to the next line, unchanged, stood", JSON.stringify(r));
    put("scripts/get.sh", RUN_ON.replace("  mosspy", "  lichenpy --index-url https://lichen.example/simple"));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/get.sh: PIP_INDEX_URL=") && r.failures[0].includes("lichenpy"), "a fetch whose words changed on the line it runs on to fails", JSON.stringify(r));
    put("scripts/get.sh", RUN_ON.replace("mossindex.example", "lichen.example"));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/get.sh: PIP_INDEX_URL=https://lichen.example"), "and so does one whose index changed on a line that runs on to it", JSON.stringify(r));
    put("scripts/get.sh", RUN_ON.replace("mossgrip.example", "lichen.example"));
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/get.sh: curl -fsSL \\ https://lichen.example"), "and so does a download whose address changed there", JSON.stringify(r));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// A scratch repository of the cases below: its folder, git in it without an account's settings, and `put` (write, stage).
const scratchRepo = (prefix) => {
  const dir = scratchDir(prefix);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  return { dir, git, put: (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); git("add", "-A"); } };
};

// A lock file named in another case than npm's own is read since #1349: where the pull request's base held it, it is
// reported and passes; one the pull request adds, one with no base, and one where the base held a folder, fails.
{
  const { dir, git, put } = scratchRepo("licence-scan-case-");
  const config = { ships: [], lockfiles: [], audit: "audit.json", scan: { served: [], skip: [] } };
  const said = (list) => list.some((m) => m.startsWith("tools/Package-Lock.json installs packages"));
  try {
    put("audit.json", JSON.stringify({ entries: [] }));
    git("commit", "-q", "-m", "base");
    put("tools/Package-Lock.json", "{}"); git("commit", "-q", "-m", "a lock file in another case");
    put("README.md", "a change of its own\n"); git("commit", "-q", "-m", "c");
    let r = licenceCheck(config, dir, "HEAD^1", config);
    ok(!said(r.failures) && said(r.reports), "a lock file of another case that stood at the base is reported", JSON.stringify(r));
    r = licenceCheck(config, dir, "HEAD^1", { ...config, lockfiles: ["tools/Package-Lock.json"] });
    ok(said(r.failures), "and one the base's config named fails once the config drops it", JSON.stringify(r));
    ok(said(licenceCheck(config, dir, "HEAD^2", config).failures), "and one the pull request adds fails");
    ok(said(licenceCheck(config, dir, null, config).failures), "and so does one with no base to read it against");
    git("reset", "-q", "--hard", "HEAD~2"); put("tools/Package-Lock.json/README.md", "x"); git("commit", "-q", "-m", "a folder");
    git("rm", "-rq", "tools/Package-Lock.json"); put("tools/Package-Lock.json", "{}"); git("commit", "-q", "-m", "a lock file where a folder stood");
    ok(said(licenceCheck(config, dir, "HEAD^1", config).failures), "and one where the base held a folder of that name fails");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// A twin in another case than npm's own passes, reported, where the pair stood at the base, whichever the config names.
{
  const { dir, git, put } = scratchRepo("licence-twin-case-");
  const config = { ships: [], lockfiles: ["package-lock.json"], audit: "audit.json" };
  const stands = (list, twin) => list.some((m) => m.includes(`${twin} stands beside it`));
  try {
    for (const f of ["package-lock.json", "NPM-SHRINKWRAP.JSON"]) put(f, JSON.stringify({ lockfileVersion: 3, packages: {} }));
    put("audit.json", JSON.stringify({ entries: [] })); put("package.json", JSON.stringify({ name: "x", version: "1.0.0" }));
    git("commit", "-q", "-m", "base");
    const upper = { ...config, lockfiles: ["NPM-SHRINKWRAP.JSON"] };
    let r = licenceCheck(config, dir, "HEAD", config);
    ok(!stands(r.failures, "NPM-SHRINKWRAP.JSON") && stands(r.reports, "NPM-SHRINKWRAP.JSON"), "a twin of another case that stood at the base is reported", JSON.stringify(r));
    ok(stands(licenceCheck(config, dir, null, config).failures, "NPM-SHRINKWRAP.JSON"), "and with no base to read it against it fails");
    for (const f of ["Package-Lock.json", "NPM-SHRINKWRAP.JSON"]) {
      put(f, JSON.stringify({ lockfileVersion: 3, packages: {} })); put("npm-shrinkwrap.json", "{}"); git("commit", "-q", "-m", f);
      ok(stands(licenceCheck({ ...config, lockfiles: [f] }, dir, "HEAD^1", { ...config, lockfiles: [f] }).failures, "npm-shrinkwrap.json"), `${f} beside npm's own shrinkwrap file fails as before`);
      git("reset", "-q", "--hard", "HEAD^1");
    }
    r = licenceCheck(upper, dir, "HEAD", upper);
    ok(!stands(r.failures, "package-lock.json") && stands(r.reports, "package-lock.json"), "a pair named by its other file stands at the base too", JSON.stringify(r));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
// A read of a version index is no download of a program, and a package of the machine's distribution, kind
// "distribution", is asked no version, its download by address still asked a checksum (#1361, point 11).
{
  const SH = "scripts/setup.sh", sdk = { name: "dotnet-sdk-8.0", licence: "MIT", files: [SH] }, moss = { name: "mosstool", licence: "MIT", version: "1.2.0", files: [SH] };
  const INDEX = "V=$(curl -fsS https://dotnet.example/release-metadata/releases-index.json | jq -r '.[0].sdk')\n", APT = "apt-get install -y dotnet-sdk-8.0\n";
  const GET = "curl -fsSLo moss.tgz https://mossgrip.example/moss-1.2.0.tgz\n", CHECKED = `echo "${"0a1b2c3d".repeat(8)}  moss.tgz" | sha256sum -c -\n`;
  ok(pinFault([sdk], "audit.json", SH, `${APT}${INDEX}`) === null, "a file that reads a version index and downloads no program asks no pin of the distribution's package that covers it");
  ok(pinFault([moss], "audit.json", SH, `${INDEX}${GET}${CHECKED}`) === null, "a version index read beside a program's download asks no checksum of its own");
  ok(/names no version/u.test(pinFault([sdk, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`)?.what ?? "") && /"kind": "distribution"/u.test(pinFault([sdk, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`).mend), "an entry with no version beside a program's download is asked one, its mend naming the distribution's kind");
  ok(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`) === null, "and one of kind distribution is not");
  ok(/holds no checksum/u.test(pinFault([{ ...sdk, kind: "distribution" }], "audit.json", SH, `${APT}${GET}`)?.what ?? ""), "a download covered by a distribution's package alone is still asked its checksum");
  ok(readsData("curl -s https://dl.example/release/stable.txt") && readsData("Invoke-RestMethod https://dotnet.example/index.json?x=1"), "a text or JSON file read by address, by curl or PowerShell, is a read of data");
  const progs = ["curl -fsSL https://mossgrip.example/get.sh | bash", "curl -s https://mossgrip.example/index.json | sh", "curl -fsSLo moss.tgz https://mossgrip.example/$(curl -s https://mossgrip.example/index.json | jq -r .v)/moss.tgz", "curl -fsSLO \"$URL\""];
  ok(progs.every((d) => !readsData(d)), "a program's address, data piped into a shell, a download whose address another read makes and one with no address written are each no read of data", progs.filter(readsData).join(" | "));
  const twice = "curl -s https://mossgrip.example/index.json | jq -r .url | xargs curl -fsSLO";
  ok(!readsData(twice, [twice, twice]), "a second download in the same words, as on one line, is no read of data");
}
done();
