// Checks the licence check (licences.mjs, beside this file) and its scan (licence-scan.mjs): a small project passes as it
// is, and fails each form of something off its list or left out of its audit, each staged in a fresh copy of it (every
// name invented). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/licences-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check, licenceOk, loadConfig, policy, registryName, registryOverrides, scriptsOff } from "./licences.mjs";

let failed = 0;
const ok = (cond, what, more = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (more) console.log(more); } };

// The lists and how a licence is read, alone.
const lists = policy({ data: ["mossgrip-data"], fonts: ["mossgrip-face"] });
const code = lists.allowedFor("mossgrip-lib"), data = lists.allowedFor("mossgrip-data"), font = lists.allowedFor("mossgrip-face");
const tool = lists.allowedFor("mossgrip-cli", false);
const all = (exprs, allow, want) => exprs.every((x) => licenceOk(x, allow) === want);
ok(all(["MIT AND (BSD-2-Clause OR Apache-2.0)", "(MIT OR CC0-1.0)", "MIT OR GPL-3.0-only"], code, true)
  && all(["(MIT OR GPL-3.0-only) AND (GPL-3.0-only)", "GPL-3.0-only"], code, false), "reads AND and OR with their brackets");
ok(all([undefined, "", "MIT AND", "(MIT", "MIT OR (", "Apache-2.0 WITH LLVM-exception", "MIT AND GPL-3.0-only OR MIT"], code, false), "refuses no licence, an exception, a broken expression, and AND and OR mixed without brackets");
ok(all(["CC-BY-4.0", "OFL-1.1"], code, false) && all(["CC-BY-4.0", "PDDL-1.0"], data, true) && !licenceOk("OFL-1.1", data)
  && licenceOk("OFL-1.1", font) && !licenceOk("CC-BY-4.0", font) && licenceOk("Public Domain", code), "CC-BY only for named data, OFL only for named fonts, the public domain for any");
ok(all(["GPL-3.0-only", "LGPL-2.1-or-later", "MPL-2.0", "EUPL-1.2", "OSL-3.0", "CECILL-2.1", "MS-RL", "BSL-1.0", "Artistic-1.0-Perl", "PSF-2.0"], tool, true)
  && all(["GPL-3.0-only", "LGPL-2.1-or-later", "MPL-2.0", "EUPL-1.2", "OSL-3.0", "CECILL-2.1", "MS-RL"], code, false), "tools may use every licence the Open Source Initiative approves, what ships none of its copyleft ones");
ok(all(["BUSL-1.1", "SSPL-1.0", "Elastic-2.0", "CC-BY-NC-4.0", "CC-BY-ND-4.0", undefined], tool, false), "nor any terms floor rule 10 never allows");
ok(registryName("https://registry.npmjs.org/mossgrip-data/-/mossgrip-data-1.0.0.tgz") === "mossgrip-data" && registryName("https://registry.npmjs.org/@moss/grip/-/grip-1.0.0.tgz") === "@moss/grip"
  && [undefined, "file:vendor/mossgrip-data.tgz", "vendor/mossgrip-data", "git+https://mossgrip.example/data.git", "https://mossgrip.example/mossgrip-data/-/mossgrip-data-1.0.0.tgz"].every((r) => registryName(r) === undefined),
  "names a package by its registry address, never by a name the lockfile could be given");
const npmrc = ["registry=https://mossgrip.example/", "replace-registry-host=always", "@x:registry = https://mossgrip.example/", '"registry"=https://mossgrip.example/', '"replace-registry-host"=always', "${KEY}=https://mossgrip.example/"];
ok(JSON.stringify(registryOverrides(npmrc.join("\n"))) === JSON.stringify(npmrc) && registryOverrides("fund=false\naudit=false\n# registry=x\n; registry=x\n").length === 0
  && JSON.stringify(registryOverrides("ignore-scripts=false\nIGNORE-SCRIPTS=true\nignore-scripts=\n")) === JSON.stringify(["ignore-scripts=false", "IGNORE-SCRIPTS=true", "ignore-scripts="]),
  "refuses every npm setting but a few harmless ones, however its key is spelt");
ok(scriptsOff("# no install scripts\nignore-scripts=true\n") && !scriptsOff("ignore-scripts=false\n"), "knows when install scripts are off");

const PROJECT = {
  "licences.json": JSON.stringify({ ships: [], audit: "audit.json", scan: { served: ["site/"], tools: ["site/tools/"], skip: ["docs/"] } }),
  "audit.json": JSON.stringify({ entries: [
    { name: "actions/checkout", kind: "action", licence: "MIT" },
    { name: "mossgrip-cli", version: "1.2.3", licence: "MIT" },
    { name: "Mossface", kind: "font", licence: "OFL-1.1", ships: true, files: ["site/fonts/mossface.woff2"] },
    { name: "Bark sounds", kind: "asset", licence: "CC0-1.0", ships: true, files: ["site/audio/"] },
    { name: "The icons", kind: "own", licence: "LicenseRef-Owner", ships: true, files: ["site/icon.png"] },
    { name: "site/tools/lichen.js", licence: "GPL-3.0-only" },
  ] }),
  ".github/workflows/ci.yml": [
    "jobs:", "  a:", "    steps:", "      - uses: actions/checkout@v7", "      # - uses: mossgrip/setup-moss@v1, a comment",
    "  b:", "    uses: HaakTuah/agent-core/.github/workflows/copies.yml@0123456789abcdef0123456789abcdef01234567",
    "  c:", "    uses: ./.github/workflows/local.yml", "",
  ].join("\n"),
  "scripts/setup.sh": "npm install -g mossgrip-cli@1.2.3\nnpx --no-install vitest run\n# npm install mossgrip-widgets, a comment, fetches nothing\nnpm ci\n",
  "site/index.html": "<!doctype html><title>Bark</title>\n",
  "site/fonts/mossface.woff2": "",
  "site/audio/bark-1.m4a": "",
  "site/icon.png": "",
  "site/tools/lichen.js": "/*! lichen v1 | GPL-3.0 */\nexport const l = 1;\n",
  "docs/picture.png": "",
};

/** A fresh copy of the project, changed by `change(dir)`, and the check's failures on it (or the error it throws). */
function run(change = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "licences-test-"));
  try {
    for (const [f, text] of Object.entries(PROJECT)) { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
    change(dir);
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", "-A"], { cwd: dir });
    const { failures } = check(loadConfig(path.join(dir, "licences.json")), dir);
    return failures;
  } catch (e) {
    return [`threw: ${e.message}`];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const write = (f, text) => (dir) => { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const append = (f, text) => (dir) => fs.appendFileSync(path.join(dir, f), text);
const json = (f, edit) => (dir) => { const p = path.join(dir, f), j = JSON.parse(fs.readFileSync(p, "utf8")); edit(j); fs.writeFileSync(p, JSON.stringify(j)); };
const entry = (e) => json("audit.json", (j) => j.entries.push(e));

const base = run();
ok(base.length === 0, "the project as it is passes", base.join("\n"));
for (const [what, change] of [
  ["a tool that only runs under GPL", entry({ name: "mossgrip-lint", licence: "GPL-3.0-only" })],
  ["npx --no-install with a bare name, which never fetches", append("scripts/setup.sh", "npx --no tsc --noEmit\n")],
  ["an npm install with no package, into a folder", append("scripts/setup.sh", "npm install --prefix tools\n")],
  ["a file under skip", write("docs/lichen.min.js", "/*! lichen v1 | GPL-3.0 */\n")],
  ["the project's copy of the core, audited by the core", write("core/scripts/moss.min.js", "/*! moss v1 */\n")],
  ["a second file in a folder an entry covers", write("site/audio/bark-2.m4a", "")],
]) { const f = run(change); ok(f.length === 0, `passes ${what}`, f.join("\n")); }

for (const [what, change] of [
  ["a tool under a licence that is not open source", entry({ name: "mossgrip-widgets", licence: "LicenseRef-Mossgrip-Proprietary" })],
  ["what ships under a licence only tools may use", entry({ name: "mossgrip-widgets", licence: "MPL-2.0", ships: true })],
  ["a tool under terms floor rule 10 never allows", entry({ name: "mossgrip-cli-pro", licence: "BUSL-1.1" })],
  ["GitHub's terms on what is not GitHub's", entry({ name: "mossgrip-cli-pro", licence: "LicenseRef-GitHub-Terms" })],
  ["an allowed licence grouped with one off the list, in what ships", entry({ name: "mossgrip-widgets", licence: "(MIT OR GPL-3.0-only) AND GPL-3.0-only", ships: true })],
  ["AND and OR mixed without brackets", entry({ name: "mossgrip-widgets", licence: "MIT AND GPL-3.0-only OR MIT" })],
  ["the owner's licence on what is not his own", entry({ name: "mossgrip-widgets", licence: "LicenseRef-Owner" })],
  ["his own work under another licence", entry({ name: "Bark pictures", kind: "own", licence: "MIT", files: ["site/icon.png"] })],
  ["an action not in the audit", append(".github/workflows/ci.yml", "      - uses: mossgrip/setup-moss@v1\n")],
  ["an action in an action of the project's own", write(".github/actions/moss/action.yml", "runs:\n  steps:\n    - uses: mossgrip/setup-moss@v1\n")],
  ["a container action not in the audit", append(".github/workflows/ci.yml", "      - uses: docker://mossgrip/moss:1\n")],
  ["npm install of a package not in the audit", append("scripts/setup.sh", "npm install -g mossgrip-widgets@1.2.3\n")],
  ["an audited package fetched at another version", append("scripts/setup.sh", "npm install -g mossgrip-cli@1.3.0\n")],
  ["npm install with an option before install", append("scripts/setup.sh", "npm -g install mossgrip-widgets\n")],
  ["npm install without a version", append("scripts/setup.sh", "npm install --no-save mossgrip-cli\n")],
  ["npm install of a major version alone", append("scripts/setup.sh", "npm install -g --prefix /opt/moss mossgrip-cli@1\n")],
  ["npm install of a range", append("scripts/setup.sh", "npm install mossgrip-cli@^1.2.3\n")],
  ["npm install of an alias", append("scripts/setup.sh", "npm install mossgrip-cli@npm:mossgrip-lint@9.0.0\n")],
  ["npm install from a URL", append("scripts/setup.sh", "npm install https://mossgrip.example/widgets.tgz\n")],
  ["npm install from git", append("scripts/setup.sh", "npm install git+https://mossgrip.example/widgets.git\n")],
  ["npm install of a variable", append("scripts/setup.sh", 'npm i "$PKG"\n')],
  ["npx of a package without a version", append("scripts/setup.sh", "npx -y mossgrip-cli build\n")],
  ["npm exec of a package without a version", append("scripts/setup.sh", "npm exec -- mossgrip-cli build\n")],
  ["npx in a string a tool runs", write("scripts/crop.js", "require('child_process').execSync('npx -y mossgrip-cli');\n")],
  ["npx in a tool written as a module", write("scripts/moss.mjs", "import { execSync } from 'child_process';\nexecSync('npx -y mossgrip-cli');\n")],
  ["npx in a workflow", append(".github/workflows/ci.yml", "      - run: npx mossgrip-cli\n")],
  ["third-party code copied into what ships", write("site/lib/mossgrip.min.js", "/*! mossgrip v1 | MIT */\nvar m=1;\n")],
  ["third-party code that ships, audited as a tool", (dir) => { write("site/lib/mossgrip.min.js", "/*! mossgrip v1 | MIT */\nvar m=1;\n")(dir); entry({ name: "site/lib/mossgrip.min.js", licence: "MIT" })(dir); }],
  ["third-party code copied into a tool", write("scripts/lichen.mjs", "// SPDX-License-Identifier: MIT\nexport const l = 1;\n")],
  ["a font, image or sound not in the audit", write("site/bark.png", "")],
  ["a font kept with a tool, not in the audit", write("scripts/mossface.ttf", "")],
  ["an asset that ships, covered only by a tool's entry", json("audit.json", (j) => { j.entries.find((e) => e.name === "Bark sounds").ships = false; })],
  ["an entry covering a file that is gone", json("audit.json", (j) => j.entries.push({ name: "Old bark", kind: "asset", licence: "CC0-1.0", ships: true, files: ["site/old-bark.m4a"] }))],
  ['"files" that is not a list of paths', json("audit.json", (j) => { j.entries.find((e) => e.name === "Bark sounds").files = "site/audio/"; })],
  ["a scan key it does not know", json("licences.json", (j) => { j.scan.servd = ["site/"]; })],
  ["a scan path outside the project", json("licences.json", (j) => { j.scan.skip = ["../elsewhere/"]; })],
  ["a scan that skips everything", json("licences.json", (j) => { j.scan.skip = [""]; })],
  ["a scan without an audit", json("licences.json", (j) => { delete j.audit; j.lockfiles = ["package-lock.json"]; })],
]) { const f = run(change); ok(f.length > 0, `fails on ${what}`); }

process.exit(failed ? 1 : 0);
