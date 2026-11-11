// Checks the licence check (licences.mjs, beside this file) and its scan (licence-scan.mjs): its lists and readers alone,
// then a small project that passes as it is, passes each allowed form, and fails each form of something off its list or
// left out of its audit, for the reason it names, each staged in a fresh copy of it (every name invented). Run by the
// core's tests workflow (.github/workflows/tests.yml).
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
  && JSON.stringify(registryOverrides("ignore-scripts=true\nregistry=https://mossgrip.example/\n")) === JSON.stringify(["registry=https://mossgrip.example/"])
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

const LOCK = (license) => (dir) => {
  write("package.json", JSON.stringify({ name: "bark", dependencies: { "mossgrip-lib": "1.0.0" } }))(dir);
  write("package-lock.json", JSON.stringify({ name: "bark", lockfileVersion: 3, packages: {
    "": { name: "bark", dependencies: { "mossgrip-lib": "1.0.0" } },
    "node_modules/mossgrip-lib": { version: "1.0.0", resolved: "https://registry.npmjs.org/mossgrip-lib/-/mossgrip-lib-1.0.0.tgz", license },
  } }))(dir);
  json("licences.json", (j) => { j.lockfiles = ["package-lock.json"]; })(dir);
};
const handAudited = (f) => entry({ name: "Moss tools", licence: "MIT", files: [f] });
for (const [what, change] of [
  ["a tool that only runs under GPL", entry({ name: "mossgrip-lint", licence: "GPL-3.0-only" })],
  ["npx --no-install with a bare name, which never fetches", append("scripts/setup.sh", "npx --no tsc --noEmit\n")],
  ["an npm install with no package, into a folder", append("scripts/setup.sh", "npm install --prefix tools\n")],
  ["npm ci and npm run, which fetch nothing new", append("scripts/setup.sh", "npm ci --prefix tools\nnpm run build\n")],
  ["a file under skip", write("docs/lichen.min.js", "/*! lichen v1 | GPL-3.0 */\n")],
  ["the project's copy of the core, audited by the core", (dir) => { write("core-manifest.md", "# Core manifest\n")(dir); write("core/scripts/moss.min.js", "/*! moss v1 */\n")(dir); }],
  ["a second file in a folder an entry covers", write("site/audio/bark-2.m4a", "")],
  ["an audited package in a string a tool runs", write("scripts/run.js", "require('child_process').execSync('npx mossgrip-cli@1.2.3');\n")],
  ["two versions of a package, each audited", (dir) => { entry({ name: "mossgrip-cli", version: "2.0.0", licence: "MIT" })(dir); append("scripts/setup.sh", "npm install -g mossgrip-cli@2.0.0\n")(dir); }],
  ["an audited package in package.json's scripts", write("package.json", JSON.stringify({ scripts: { build: "npx mossgrip-cli@1.2.3 build", test: "vitest run" } }))],
  ["a command named in prose, not run", write("site/notes.json", JSON.stringify({ about: "run npm install mossgrip-widgets to see" }))],
  ["a word that only looks like a fetcher", write("scripts/tongue.js", "const curl = 1 - e, steps = 4 * curl;\nconst tip = 'a curl of bark';\nexecFileSync('git', ['ls-files']);\n")],
  ["a config with comments", write("site/jsconfig.json", "{\n  // the game's own types\n  \"compilerOptions\": {}\n}\n")],
  ["a fetch it cannot read, in a file an entry audits by hand", (dir) => { handAudited("scripts/setup.sh")(dir); append("scripts/setup.sh", 'npm pack --ignore-scripts "moss-linux-$ARCH@$V"\ncurl -sSfo moss.tgz https://mossgrip.example/moss.tgz\n')(dir); }],
  ["a script in another language, named by the entries of what it uses", (dir) => { write("scripts/render.py", "import numpy\n")(dir); handAudited("scripts/render.py")(dir); }],
  ["a lockfile the config names, a tool in it under GPL", LOCK("GPL-3.0-only")],
]) { const f = run(change); ok(f.length === 0, `passes ${what}`, f.join("\n")); }

for (const [what, change, why] of [
  ["a tool under a licence that is not open source", entry({ name: "mossgrip-widgets", licence: "LicenseRef-Mossgrip-Proprietary" }), /not on the list for tools/],
  ["what ships under a licence only tools may use", entry({ name: "mossgrip-widgets", licence: "MPL-2.0", ships: true }), /not on the list for what ships/],
  ["a tool under terms floor rule 10 never allows", entry({ name: "mossgrip-cli-pro", licence: "BUSL-1.1" }), /not on the list/],
  ["GitHub's terms on what is not GitHub's", entry({ name: "mossgrip-cli-pro", licence: "LicenseRef-GitHub-Terms" }), /not on the list/],
  ["an allowed licence grouped with one off the list, in what ships", entry({ name: "mossgrip-widgets", licence: "(MIT OR GPL-3.0-only) AND GPL-3.0-only", ships: true }), /not on the list for what ships/],
  ["AND and OR mixed without brackets", entry({ name: "mossgrip-widgets", licence: "MIT AND GPL-3.0-only OR MIT" }), /not on the list/],
  ["a package that ships, in a lockfile, under GPL", (dir) => { LOCK("GPL-3.0-only")(dir); json("licences.json", (j) => { j.ships = ["package.json"]; })(dir); }, /off the list for what ships: mossgrip-lib/],
  ["the owner's licence on what is not his own", entry({ name: "mossgrip-widgets", licence: "LicenseRef-Owner" }), /the owner's own work is/],
  ["his own work under another licence", entry({ name: "Bark pictures", kind: "own", licence: "MIT", files: ["site/icon.png"] }), /the owner's own work is/],
  ["his own work named as a folder", entry({ name: "Bark pictures", kind: "own", licence: "LicenseRef-Owner", files: ["site/audio/"] }), /one by one/],
  ["his own work standing in for an action", (dir) => { entry({ name: "mossgrip/setup-moss", kind: "own", licence: "LicenseRef-Owner" })(dir); append(".github/workflows/ci.yml", "      - uses: mossgrip/setup-moss@v1\n")(dir); }, /mossgrip\/setup-moss .* is not in/],
  ["his own work covering code with someone's notice", (dir) => { write("site/lib/moss.js", "/*! moss v1 | MIT */\n")(dir); entry({ name: "Bark code", kind: "own", licence: "LicenseRef-Owner", ships: true, files: ["site/lib/moss.js"] })(dir); }, /not the owner's own/],
  ["an action not in the audit", append(".github/workflows/ci.yml", "      - uses: mossgrip/setup-moss@v1\n"), /mossgrip\/setup-moss .* is not in/],
  ["an action in an action of the project's own", write(".github/actions/moss/action.yml", "runs:\n  steps:\n    - uses: mossgrip/setup-moss@v1\n"), /mossgrip\/setup-moss/],
  ["a container action not in the audit", append(".github/workflows/ci.yml", "      - uses: docker://mossgrip/moss:1\n"), /docker:\/\/mossgrip\/moss:1/],
  ["an action in a YAML flow mapping", append(".github/workflows/ci.yml", '      - { name: "step #1", uses: mossgrip/setup-moss@v1 }\n'), /mossgrip\/setup-moss/],
  ["an action under a quoted key", append(".github/workflows/ci.yml", "      - 'uses': mossgrip/setup-moss@v1\n"), /mossgrip\/setup-moss/],
  ["npm install of a package not in the audit", append("scripts/setup.sh", "npm install -g mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["an audited package fetched at another version", append("scripts/setup.sh", "npm install -g mossgrip-cli@1.3.0\n"), /audited at 1\.2\.3/],
  ["npm install with an option before install", append("scripts/setup.sh", "npm -g install mossgrip-widgets\n"), /cannot be audited/],
  ["npm install with an option and its value before install", append("scripts/setup.sh", "npm --prefix tools install mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["npm i after its log level", append("scripts/setup.sh", "npm --loglevel error i mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install spelt another way", append("scripts/setup.sh", "npm isntall mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install-test", append("scripts/setup.sh", "npm it mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm pack of a package not in the audit", append("scripts/setup.sh", "npm pack mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm pack of a variable", append("scripts/setup.sh", 'npm pack --ignore-scripts "moss-linux-$ARCH@$V"\n'), /moss-linux-\$ARCH@\$V cannot be audited/],
  ["npm create, which fetches by another name", append("scripts/setup.sh", "npm create mossgrip\n"), /by another name/],
  ["npm init of a package", append("scripts/setup.sh", "npm init mossgrip@1.2.3\n"), /by another name/],
  ["npm install without a version", append("scripts/setup.sh", "npm install --no-save mossgrip-cli\n"), /cannot be audited/],
  ["npm install of a major version alone", append("scripts/setup.sh", "npm install -g --prefix /opt/moss mossgrip-cli@1\n"), /mossgrip-cli@1 cannot be audited/],
  ["npm install of a range", append("scripts/setup.sh", "npm install mossgrip-cli@^1.2.3\n"), /cannot be audited/],
  ["npm install of an alias", append("scripts/setup.sh", "npm install mossgrip-cli@npm:mossgrip-lint@9.0.0\n"), /cannot be audited/],
  ["npm install from a URL", append("scripts/setup.sh", "npm install https://mossgrip.example/widgets.tgz\n"), /cannot be audited/],
  ["npm install from git", append("scripts/setup.sh", "npm install git+https://mossgrip.example/widgets.git\n"), /cannot be audited/],
  ["npm install of a variable", append("scripts/setup.sh", 'npm i "$PKG"\n'), /\$PKG cannot be audited/],
  ["npm install continued on the next line", append("scripts/setup.sh", "npm install -g \\\n  mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npx of a package without a version", append("scripts/setup.sh", "npx -y mossgrip-cli build\n"), /cannot be audited/],
  ["npx of a bare name, even in a file an entry audits by hand", (dir) => { handAudited("scripts/setup.sh")(dir); append("scripts/setup.sh", "npx -y mossgrip-cli build\n")(dir); }, /cannot be audited/],
  ["npm exec of a package without a version", append("scripts/setup.sh", "npm exec -- mossgrip-cli build\n"), /cannot be audited/],
  ["npx after a # inside a string, which is no comment", append("scripts/setup.sh", 'echo "# a heading"; npx -y mossgrip-widgets\n'), /cannot be audited/],
  ["npx after a # inside a string, in a workflow", append(".github/workflows/ci.yml", '      - run: echo "build #1"; npx -y mossgrip-widgets\n'), /cannot be audited/],
  ["npx in a string a tool runs", write("scripts/crop.js", "require('child_process').execSync('npx -y mossgrip-cli');\n"), /cannot be audited/],
  ["npx written as an array", write("scripts/crop.mjs", "import { execFileSync } from 'node:child_process';\nexecFileSync('npx', ['-y', 'mossgrip-cli']);\n"), /mossgrip-cli cannot be audited/],
  ["npm install written as an array", write("scripts/crop.cjs", "spawnSync(\"npm\", [\"install\", \"mossgrip-widgets@1.2.3\"]);\n"), /mossgrip-widgets .* is not in/],
  ["npx in a TypeScript component", write("site/tools/run.tsx", "execSync('npx -y mossgrip-cli');\n"), /cannot be audited/],
  ["npx in a workflow", append(".github/workflows/ci.yml", "      - run: npx mossgrip-cli\n"), /cannot be audited/],
  ["npx in package.json's scripts", write("package.json", JSON.stringify({ scripts: { build: "npx mossgrip-widgets@1.2.3 build" } })), /mossgrip-widgets .* is not in/],
  ["npx in a hook's command", write(".claude/settings.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "npx -y mossgrip-cli" }] }] } })), /cannot be audited/],
  ["npx in a script with no extension", write(".husky/pre-commit", "#!/usr/bin/env sh\nnpx -y mossgrip-cli\n"), /cannot be audited/],
  ["npm install in a Dockerfile", write("Dockerfile", "FROM node\nRUN npm install -g mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["curl in a script", append("scripts/setup.sh", "curl -sSfo moss.tgz https://mossgrip.example/moss.tgz\n"), /fetches what no entry/],
  ["curl run by a tool", write("scripts/tiles.mjs", "execFileSync(\"curl\", [\"-sSf\", \"https://mossgrip.example/tile.png\"]);\n"), /fetches what no entry/],
  ["pip install", append("scripts/setup.sh", "pip install mosspy\n"), /fetches what no entry/],
  ["playwright install", append(".github/workflows/ci.yml", "      - run: npx --no-install playwright install chromium\n"), /fetches what no entry/],
  ["a script in a language the scan cannot read", write("scripts/render.py", "import numpy\n"), /language the scan cannot read/],
  ["a package.json that cannot be read", write("site/package.json", "{ scripts: "), /cannot be read as JSON/],
  ["npx in a config with comments", write("site/jsconfig.json", "{\n  // a comment\n  \"run\": \"npx -y mossgrip-cli\"\n}\n"), /cannot be audited/],
  ["a lockfile the config does not name", write("tools/package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": {} } })), /"lockfiles" does not name/],
  ["a package.json with dependencies no named lockfile installs", write("tools/package.json", JSON.stringify({ devDependencies: { "mossgrip-lint": "1.0.0" } })), /no lockfile the config names installs/],
  ["third-party code copied into what ships", write("site/lib/mossgrip.min.js", "/*! mossgrip v1 | MIT */\nvar m=1;\n"), /licence notice\) is not in/],
  ["third-party code that ships, audited as a tool", (dir) => { write("site/lib/mossgrip.min.js", "/*! mossgrip v1 | MIT */\nvar m=1;\n")(dir); entry({ name: "site/lib/mossgrip.min.js", licence: "MIT" })(dir); }, /reaches users/],
  ["third-party code copied into a tool", write("scripts/lichen.mjs", "// SPDX-License-Identifier: MIT\nexport const l = 1;\n"), /licence notice/],
  ["a notice written as a year", write("site/lib/moss.css", "/* Copyright 2020 Mossgrip Ltd. */\n"), /licence notice/],
  ["a font, image or sound not in the audit", write("site/bark.png", ""), /bark\.png .* is not in/],
  ["a font kept with a tool, not in the audit", write("scripts/mossface.ttf", ""), /mossface\.ttf/],
  ["a WebAssembly module not in the audit", write("site/moss.wasm", ""), /moss\.wasm/],
  ["a binary file whatever its name", write("site/moss.dat", "\u0000\u0001\u0002moss\u0000"), /binary file/],
  ["an asset that ships, covered only by a tool's entry", json("audit.json", (j) => { j.entries.find((e) => e.name === "Bark sounds").ships = false; }), /reaches users/],
  ["an entry covering a file that is gone", entry({ name: "Old bark", kind: "asset", licence: "CC0-1.0", ships: true, files: ["site/old-bark.m4a"] }), /names no tracked file/],
  ['"files" that is not a list of paths', json("audit.json", (j) => { j.entries.find((e) => e.name === "Bark sounds").files = "site/audio/"; }), /not a list of paths/],
  ["a scan key it does not know", json("licences.json", (j) => { j.scan.servd = ["site/"]; }), /keys it does not know/],
  ["a scan that does not say what reaches users", json("licences.json", (j) => { delete j.scan.served; }), /what reaches users/],
  ["a scan path outside the project", json("licences.json", (j) => { j.scan.skip = ["../elsewhere/"]; }), /not a list of paths in the project/],
  ["a scan that skips everything", json("licences.json", (j) => { j.scan.skip = [""]; }), /not a list of paths in the project/],
  ["a scan path written another way than git lists it", json("licences.json", (j) => { j.scan.served = ["./site/"]; }), /not a list of paths in the project/],
  ['a scan folder without its "/", which names no file', json("licences.json", (j) => { j.scan.served = ["site"]; }), /names no tracked file/],
  ["a scan path that names nothing", json("licences.json", (j) => { j.scan.skip = ["notes/"]; }), /names no tracked file/],
  ["a scan without an audit", json("licences.json", (j) => { delete j.audit; j.lockfiles = ["package-lock.json"]; }), /needs an "audit"/],
]) { const f = run(change); ok(f.some((m) => why.test(m)), `fails on ${what}`, f.join("\n") || "(it passed)"); }

process.exit(failed ? 1 : 0);
