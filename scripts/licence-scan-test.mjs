// Checks the licence check (licences.mjs, beside this file) on a whole project, with its scan (licence-scan.mjs): the
// staged project (licence-scan-stage.mjs) passes as it is, passes each allowed form, and fails each form of something
// off its list or left out of its audit but a fetch (licence-fetch-test.mjs has those), for the reason it names; and
// the owner's yes (licence-yes.mjs), on a package and on an audit entry; every path the config names, and every file
// the scan reads, held to the project; and JSON of any depth or length read without running out of stack. Run by the
// core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/licence-scan-test.mjs
import { LOCK, append, done, entry, handAudited, json, ok, run, write } from "./licence-scan-stage.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mended } from "./mend.mjs";
import { execFileSync } from "node:child_process";
import { check as licenceCheck } from "./licences.mjs";

// (each failure as the check prints it, one a config's fault throws too: each says its mend)
const mendSaid = (failures) => mended(failures.map((m) => `FAIL: ${m.replace(/^threw: /u, "")}`).join("\n"));

const base = run();
ok(base.length === 0, "the project as it is passes", base.join("\n"));

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
  ["a word that only looks like a fetcher", write("scripts/tongue.js", "const curl = 1 - e, steps = 4 * curl;\nconst tip = 'a curl of bark';\nexecFileSync('git', ['ls-files']);\necho \"pip\" is a word, and so is \"curl\" or 'wget'\nconst fast = t === \"bunx\" ? 1 : 2, runners = [\"node\", \"bunx\" ], by = { runner: \"bunx\" };\n")],
  ["a config with comments", write("site/jsconfig.json", "{\n  // the game's own types\n  \"compilerOptions\": {}\n}\n")],
  ["a fetch it cannot read, in a file an entry audits by hand", (dir) => { handAudited("scripts/setup.sh")(dir); append("scripts/setup.sh", 'npm pack --ignore-scripts "moss-linux-$ARCH@$V"\ncurl -sSfo moss.tgz https://mossgrip.example/moss.tgz\n')(dir); }],
  ["a script in another language, named by the entries of what it uses", (dir) => { write("scripts/render.py", "import numpy\n")(dir); handAudited("scripts/render.py")(dir); }],
  ["a lockfile the config names, a tool in it under GPL", LOCK("GPL-3.0-only")],
  ["an audited install in a string of code, with a comment after it", write("scripts/run.mjs", "execSync('npm install -g mossgrip-cli@1.2.3') // the one we audited\n")],
  ["an audited install with a comment after it", append("scripts/setup.sh", "npm install -g mossgrip-cli@1.2.3 # the one we audited\n")],
  ["a comment naming a fetcher, in a file whose lines end as Windows writes them", append("scripts/setup.sh", "# we once ran curl -L https://mossgrip.example here\r\necho moss\r\n")],
  ["a workflow comment naming a fetcher, its lines ending as Windows writes them", append(".github/workflows/ci.yml", "      # was: dotnet tool install --global mossgrip\r\n")],
  ...["dotnet restore --locked-mode", "dotnet test", "dotnet add src/Moss.csproj reference src/Bark.csproj", "dotnet tool restore", "choco list", "dotnet package list --vulnerable", "dotnet package search Mossgrip"]
    .map((line) => [`a .NET or Windows command that fetches nothing by a name written here: ${line}`, append(".github/workflows/ci.yml", `      - run: ${line}\n`)]),
  ["dotnet run as an array for what fetches nothing by a name written here", write("scripts/build.mjs", "execFileSync('dotnet', ['build', '-c', 'Release']);\nexecFileSync('dotnet', ['add', 'src/Moss.csproj', 'reference', 'src/Bark.csproj']);\nexecFileSync('dotnet', ['tool', 'restore']);\nexecFileSync('choco', ['--help']);\nexecFileSync('choco', ['list']);\n")],
  ["a PowerShell command's name held as data", write("scripts/labels.mjs", "const label = 'Invoke-WebRequest';\nif (name === \"Install-Module\") skip();\nconst all = ['iwr', 'irm', 'Start-BitsTransfer'];\nconst note = 'IRM protected, irm v1.2';\n")],
  ["npm run after an option", append("scripts/setup.sh", "npm --silent run build\n")],
  ["npm config get registry, which sets nothing", append("scripts/setup.sh", "npm config get registry\n")],
  ["npm link of a folder, and output redirected after an audited install", append("scripts/setup.sh", "npm link ../moss\nnpm install -g mossgrip-cli@1.2.3 > moss.log 2>&1\n")],
  ["an audited install nested in npx -c", append("scripts/setup.sh", "npx -c 'npm install -g mossgrip-cli@1.2.3'\n")],
  ["an audited package written as an array", write("scripts/crop.mjs", "execFileSync('npx', ['mossgrip-cli@1.2.3']);\n")],
  ["npm view with a variable, which fetches nothing", write("scripts/times.mjs", "execFileSync('npm', ['view', name, 'time', '--json']);\n")],
  ["npx and npm asked their version, and a check that npx is there", append("scripts/setup.sh", "npx --version\nnpm exec --help\nif ! command -v npx >/dev/null; then exit 1; fi\nwhich npm\n")],
  ["npm named in a long line of data, with no end within 16 KB", write("scripts/words.js", `const words = ["${"moss ".repeat(5000)}npm named here ${"bark ".repeat(1000)}"];\n`)],
  ["npm named in a message, not as a command", (dir) => { write("scripts/say.mjs", "console.log(`${file}: npm setting not allowed`);\n")(dir); append("scripts/setup.sh", "if npm ci; then echo \"npm packages: installed\"; fi\n")(dir); }],
  ["a page and a component showing commands in their text", (dir) => {
    write("site/tutorial.html", "<p>Run npx mossgrip-cli to start, or curl -o moss.tgz https://mossgrip.example/moss.tgz.</p>\n<pre>npx create-moss my-app</pre>\n<script>const moss = 1;</script>\n")(dir);
    write("site/Guide.vue", "<template><p>Run npx mossgrip-cli to start.</p></template>\n<script setup>const moss = 1;</script>\n")(dir);
  }],
  ["a page's structured data and template in script tags", write("site/howto.html", "<script type=\"application/ld+json\">{\"@type\":\"HowTo\",\"text\":\"npx mossgrip-cli\"}</script>\n<script type=\"text/template\"><p>npx mossgrip-cli</p></script>\n")],
  ["a page's comment naming a command, and a component's style block", (dir) => {
    write("site/guide.html", "<!-- Run npx mossgrip-cli to start. --><p>moss</p>\n<script>const moss = 1;</script>\n")(dir);
    write("site/Moss.vue", "<template><p>{{ moss }}</p></template>\n<style>.moss { color: green }</style>\n")(dir);
  }],
  ["npm diff, cache and publish of what is local or audited", append("scripts/setup.sh", "npm diff --diff=mossgrip-cli@1.2.3 --diff=.\nnpm cache clean --force\nnpm publish ./moss.tgz\n")],
  ["npm exec of an audited package after --", append("scripts/setup.sh", "npm exec --package=mossgrip-cli@1.2.3 -- moss build\n")],
  ["a notices file the config names, holding every shipped entry", (dir) => { write("site/NOTICES.txt", "Mossface (OFL-1.1)\nBark sounds (CC0-1.0)\n")(dir); json("licences.json", (j) => { j.notices = "site/NOTICES.txt"; })(dir); json("audit.json", (j) => j.entries.forEach((e) => delete e.notice))(dir); }],
]) { const f = run(change); ok(f.length === 0, `passes ${what}`, f.join("\n")); }
{ // (a line of many options before npm, read in time: what stands before npm is walked once, never tried two ways)
  const start = Date.now(), f = run(append("scripts/setup.sh", `sudo${" -ux".repeat(60)} X npm ci\n`));
  ok(f.length === 0 && Date.now() - start < 5000, "passes 60 options before npm, in under 5 seconds", f.join("\n") || `${Date.now() - start} ms`);
}
{ // (a long line naming npm many times, as a bundle may, read in time: what stands before each is read only so far back)
  const start = Date.now(), f = run(write("scripts/long.js", `const notes = '${`${"x".repeat(240)} npm run build; `.repeat(8000)}';\n`));
  ok(f.length === 0 && Date.now() - start < 5000, "passes a 2 MB line naming npm 8000 times, in under 5 seconds", f.join("\n") || `${Date.now() - start} ms`);
}

for (const [what, change, why] of [
  ["what ships without its notice", entry({ name: "Lichen data", kind: "data", licence: "CC0-1.0", ships: true }), /Lichen data: it ships, so its notice ships too/],
  ["what ships missing from the notices file the config names", (dir) => { write("site/NOTICES.txt", "Mossface (OFL-1.1)\n")(dir); json("licences.json", (j) => { j.notices = "site/NOTICES.txt"; })(dir); }, /Bark sounds: it ships, so its notice ships too .*: its name in site\/NOTICES\.txt/],
  ["a tool under a licence that is not open source", entry({ name: "mossgrip-widgets", licence: "LicenseRef-Mossgrip-Proprietary" }), /not on the list for tools/],
  ["what ships under a licence only tools may use", entry({ name: "mossgrip-widgets", licence: "MPL-2.0", ships: true }), /not on the list for what ships/],
  ["a tool under terms floor rule 10 never allows", entry({ name: "mossgrip-cli-pro", licence: "BUSL-1.1" }), /not on the list/],
  ["GitHub's terms on what is not GitHub's", entry({ name: "mossgrip-cli-pro", licence: "LicenseRef-GitHub-Terms" }), /not on the list/],
  ["an allowed licence grouped with one off the list, in what ships", entry({ name: "mossgrip-widgets", licence: "(MIT OR GPL-3.0-only) AND GPL-3.0-only", ships: true }), /not on the list for what ships/],
  ["AND and OR mixed without brackets", entry({ name: "mossgrip-widgets", licence: "MIT AND GPL-3.0-only OR MIT" }), /not on the list/],
  ["a package that ships, in a lockfile, under GPL", (dir) => { LOCK("GPL-3.0-only")(dir); json("licences.json", (j) => { j.ships = ["package.json"]; })(dir); }, /off the list for what ships: mossgrip-lib/],
  ["the owner's licence on what is not the owner's own", entry({ name: "mossgrip-widgets", licence: "LicenseRef-Owner" }), /the owner's own work is/],
  ["the owner's own work under another licence", entry({ name: "Bark pictures", kind: "own", licence: "MIT", files: ["site/icon.png"] }), /the owner's own work is/],
  ["the owner's own work named as a folder", entry({ name: "Bark pictures", kind: "own", licence: "LicenseRef-Owner", files: ["site/audio/"] }), /one by one/],
  ["the owner's own work standing in for an action", (dir) => { entry({ name: "mossgrip/setup-moss", kind: "own", licence: "LicenseRef-Owner" })(dir); append(".github/workflows/ci.yml", "      - uses: mossgrip/setup-moss@v1\n")(dir); }, /mossgrip\/setup-moss .* is not in/],
  ["the owner's own work covering code with someone's notice", (dir) => { write("site/lib/moss.js", "/*! moss v1 | MIT */\n")(dir); entry({ name: "Bark code", kind: "own", licence: "LicenseRef-Owner", ships: true, files: ["site/lib/moss.js"] })(dir); }, /not the owner's own/],
  ["an action not in the audit", append(".github/workflows/ci.yml", "      - uses: mossgrip/setup-moss@v1\n"), /mossgrip\/setup-moss .* is not in/],
  ["an action in an action of the project's own", write(".github/actions/moss/action.yml", "runs:\n  steps:\n    - uses: mossgrip/setup-moss@v1\n"), /mossgrip\/setup-moss/],
  ["an action under a quoted key", append(".github/workflows/ci.yml", "      - 'uses': mossgrip/setup-moss@v1\n"), /mossgrip\/setup-moss/],
  ["an audited package fetched at another version", append("scripts/setup.sh", "npm install -g mossgrip-cli@1.3.0\n"), /audited at 1\.2\.3/],
  ["a package.json script named like prose", write("package.json", JSON.stringify({ scripts: { help: "npx -y mossgrip-cli", description: "npx -y mossgrip-cli" } })), /cannot be audited/],
  ["the owner's own picture carrying someone's licence notice", (dir) => { write("site/icon.svg", "<!-- SPDX-License-Identifier: GPL-3.0-only --><svg/>\n")(dir); entry({ name: "Moss icon", kind: "own", licence: "LicenseRef-Owner", ships: true, files: ["site/icon.svg"] })(dir); }, /not the owner's own/],
  ["a package.json that cannot be read", write("site/package.json", "{ scripts: "), /cannot be read as JSON/],
  ["a lockfile the config does not name", write("tools/package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": {} } })), /"lockfiles" does not name/],
  ["a package.json with dependencies no named lockfile installs", write("tools/package.json", JSON.stringify({ devDependencies: { "mossgrip-lint": "1.0.0" } })), /no lockfile the config names installs/],
  ["third-party code copied into what ships", write("site/lib/mossgrip.min.js", "/*! mossgrip v1 | MIT */\nvar m=1;\n"), /licence notice\) is not in/],
  ["third-party code that ships, audited as a tool", (dir) => { write("site/lib/mossgrip.min.js", "/*! mossgrip v1 | MIT */\nvar m=1;\n")(dir); entry({ name: "site/lib/mossgrip.min.js", licence: "MIT" })(dir); }, /reaches users/],
  ["third-party code copied into a tool", write("scripts/lichen.mjs", "// SPDX-License-Identifier: MIT\nexport const l = 1;\n"), /licence notice/],
  ["a notice written as a year", write("site/lib/moss.css", "/* Copyright 2020 Mossgrip Ltd. */\n"), /licence notice/],
  ["a file that ships, covered by two entries and one of them a tool's", (dir) => { write("site/bundle.js", "/*! moss bundle */\n")(dir); entry({ name: "Moss lib", licence: "MIT", ships: true, files: ["site/bundle.js"] })(dir); entry({ name: "Lichen lib", licence: "GPL-3.0-only", files: ["site/bundle.js"] })(dir); }, /every entry covering it ships/],
  ["a licence notice in a JSON file with comments", write("site/theme.jsonc", "// SPDX-License-Identifier: GPL-3.0-only\n{ \"moss\": 1 }\n"), /theme\.jsonc \(a file carrying a licence notice\)/],
  ["a file that ships, covered only by a tool's entry, with no notice in it", (dir) => { write("site/vendor.js", "export const moss = 1;\n")(dir); entry({ name: "Moss library", licence: "GPL-3.0-only", files: ["site/vendor.js"] })(dir); }, /covers site\/vendor\.js, which reaches users, so it ships/],
  ["code copied in, in a language it does not run", write("site/lib.c", "/* SPDX-License-Identifier: GPL-3.0-only */\nint moss;\n"), /lib\.c \(a file carrying a licence notice\)/],
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
  ...["node_modules//mossgrip-lib", "node_modules/./mossgrip-lib", "node_modules/x/../mossgrip-lib", "node_modules/mossgrip-lib/", "/node_modules/mossgrip-lib"].map((key) => [`a lock file with an entry at ${key}, which is not written as npm writes one`,
    (dir) => { LOCK("MIT")(dir); json("package-lock.json", (j) => { j.packages[key] = j.packages["node_modules/mossgrip-lib"]; delete j.packages["node_modules/mossgrip-lib"]; })(dir); }, /package-lock\.json holds an entry at ".*" that is not written as npm writes one/]),
  ["a lock file with an entry that is no entry", (dir) => { LOCK("MIT")(dir); json("package-lock.json", (j) => { j.packages["node_modules/mossgrip-lib"] = "MIT"; })(dir); }, /that is not written as npm writes one/],
  ["a shrinkwrap file beside the lock file the config names", (dir) => { LOCK("MIT")(dir); write("npm-shrinkwrap.json", "{}")(dir); }, /package-lock\.json: npm-shrinkwrap\.json stands beside it, and an install reads the shrinkwrap file of the two\. Mend: delete one/],
  ["notices that are no path", json("licences.json", (j) => { j.notices = 7; }), /"notices" is not a path/],
  ["notices without an audit", (dir) => { LOCK("MIT")(dir); json("licences.json", (j) => { delete j.audit; delete j.scan; j.notices = "site/NOTICES.txt"; })(dir); }, /names no "audit"/],
  ["notices naming no file", json("licences.json", (j) => { j.notices = "site/NOTICES.txt"; }), /"notices", site\/NOTICES\.txt, names no file/],
  ["notices naming a folder", json("licences.json", (j) => { j.notices = "site/audio"; }), /"notices", site\/audio, names no file/],
]) { const f = run(change); ok(f.some((m) => why.test(m)) && mendSaid(f), `fails on ${what}, each failure saying its mend`, f.join("\n") || "(it passed)"); }

// The owner's yes (licence-yes.mjs): a package or an audit entry off its list passes only by it, and never further.
{
  const said = "the owner, 13 November 2026: take it";
  const yes = (more = {}) => ({ package: "mossgrip-lib@1.0.0", licence: "LGPL-3.0-only", ships: true, yes: said, notice: "Mossgrip, LGPL 3.0.", ...more });
  const shipped = (license, accepted) => (dir) => { LOCK(license)(dir); json("licences.json", (j) => { j.ships = ["package.json"]; if (accepted) j.accepted = accepted; })(dir); };
  const paid = { name: "Bark pack", kind: "asset", licence: "LicenseRef-Vendor-EULA", ships: true, files: ["site/audio/"], notice: "Bark pack, bought." };
  const ours = (more = {}) => ({ entry: "Bark pack", licence: "LicenseRef-Vendor-EULA", ships: true, yes: said, ...more });
  const bought = (accepted, e = paid) => (dir) => { json("audit.json", (j) => { j.entries = j.entries.filter((x) => x.name !== "Bark sounds").concat(e); })(dir); json("licences.json", (j) => { j.accepted = accepted; })(dir); };
  const bare = shipped("LGPL-3.0-only");
  for (const [what, change] of [
    ["a shipped package under LGPL, with the owner's yes for that version and its notice", shipped("LGPL-3.0-only", [yes()])],
    ["a shipped package whose lockfile names no licence, read by hand and bought", shipped(undefined, [yes({ licence: "LicenseRef-Vendor-EULA" })])],
    ["a tool that only runs under terms off the tools' list, accepted as a tool, with no notice", (dir) => { LOCK("LicenseRef-Vendor-EULA")(dir); json("licences.json", (j) => { j.accepted = [yes({ licence: "LicenseRef-Vendor-EULA", ships: false, notice: undefined })]; })(dir); }],
    ["an audit entry that was bought, with the owner's yes", bought([ours()])],
    ["a tool a script installs, off the tools' list, with the owner's yes for its version", (dir) => { json("audit.json", (j) => { j.entries.find((x) => x.name === "mossgrip-cli").licence = "LicenseRef-Vendor-EULA"; })(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "mossgrip-cli", version: "1.2.3", ships: false })]; })(dir); }],
    ["a yes whose licence is a whole expression", shipped(undefined, [yes({ licence: "LicenseRef-A AND (MIT OR LGPL-3.0-only)" })])],
    ["a bought package whose own fields name no licence but say UNLICENSED, read by hand", shipped("UNLICENSED", [yes({ licence: "LicenseRef-Vendor-EULA" })])],
  ]) { const f = run(change); ok(f.length === 0, `passes ${what}`, f.join("\n")); }
  for (const [what, change, why] of [
    ["a shipped package under LGPL with no yes, and says where one goes", bare, /off the list for what ships: mossgrip-lib@1\.0\.0 \(LGPL-3\.0-only\).*Mend: .*goes in the config's "accepted"/],
    ["a yes for another version", shipped("LGPL-3.0-only", [yes({ package: "mossgrip-lib@1.0.1" })]), /off the list for what ships: mossgrip-lib@1\.0\.0/],
    ["a yes that nothing installs", shipped("LGPL-3.0-only", [yes(), yes({ package: "mossgrip-old@2.0.0" })]), /"accepted" names mossgrip-old@2\.0\.0, which nothing installs\. Mend: take that yes out of "accepted"/],
    ["a yes for what is on its list", shipped("MIT", [yes({ licence: "MIT" })]), /which is on its list and needs no yes\. Mend: take that yes out/],
    ["a yes for a tool, where it ships", shipped("LGPL-3.0-only", [yes({ ships: false })]), /a yes for a tool is no yes for what ships/],
    ["a yes for what ships with no notice", shipped("LGPL-3.0-only", [yes({ notice: " " })]), /its notice ships too.*Mend: give its yes in "accepted" its "notice"/],
    ["a yes under non-commercial terms, by the yes", shipped(undefined, [yes({ licence: "CC-BY-NC-4.0" })]), /accepted, and under CC-BY-NC-4\.0, terms floor rule 10 never allows/],
    ["a yes under source-available terms, by the lockfile", shipped("BUSL-1.1", [yes()]), /accepted, and under BUSL-1\.1, terms floor rule 10 never allows/],
    ["a package under terms the floor never allows, with no word of a yes", shipped("SSPL-1.0"), /^off the list for what ships: mossgrip-lib@1\.0\.0 \(SSPL-1\.0\), in package-lock\.json\. Mend: replace it with a package under a licence on that list; floor rule 10 never takes these terms in$/],
    ["a yes with no words of the owner's", shipped("LGPL-3.0-only", [yes({ yes: " " })]), /"accepted" is not in the form it reads\. Mend: write it as a list of/],
    ["a yes with a key it does not know", shipped("LGPL-3.0-only", [yes({ why: "needed" })]), /"accepted" is not in the form it reads/],
    ["a yes naming a package with no version", shipped("LGPL-3.0-only", [yes({ package: "mossgrip-lib" })]), /"accepted" is not in the form it reads/],
    ["a yes given twice", shipped("LGPL-3.0-only", [yes(), yes()]), /names one twice: package mossgrip-lib@1\.0\.0/],
    ["a yes for a package that comes from elsewhere than the registry", (dir) => { shipped("LGPL-3.0-only", [yes()])(dir); json("package-lock.json", (j) => { j.packages["node_modules/mossgrip-lib"].resolved = "https://mossgrip.example/mossgrip-lib/-/mossgrip-lib-1.0.0.tgz"; })(dir); }, /off the list for what ships: mossgrip-lib@1\.0\.0/],
    ...["AND", "MIT AND", "see the vendor's page"].map((words) => [`a yes whose licence reads "${words}", which is no whole expression`, shipped(undefined, [yes({ licence: words })]), /which no machine can read/]),
    ...["PolyForm-Noncommercial-1.0.0", "FSL-1.1-MIT", "BSL-1.1", "MIT + Commons Clause", "LicenseRef-NonCommercial", { type: "BUSL-1.1" }, ["SSPL-1.0"]].map((l) => [`a yes for a package whose lockfile says ${JSON.stringify(l)}`, shipped(l, [yes({ licence: "LicenseRef-Vendor-EULA" })]), /accepted, and under .*, terms floor rule 10 never allows/]),
    ["a yes under source-available terms by a name the owner gave", shipped(undefined, [yes({ licence: "LicenseRef-Business-Source" })]), /accepted, and under LicenseRef-Business-Source, terms floor rule 10 never allows/],
    ["a yes for a version the lockfile claims and its registry address does not", (dir) => { shipped("LGPL-3.0-only", [yes()])(dir); json("package-lock.json", (j) => { j.packages["node_modules/mossgrip-lib"].resolved = "https://registry.npmjs.org/mossgrip-lib/-/mossgrip-lib-2.0.0.tgz"; })(dir); }, /off the list for what ships: mossgrip-lib@1\.0\.0/],
    ["a yes that names another licence than the lockfile's", shipped("LGPL-3.0-only", [yes({ licence: "MIT" })]), /accepted under MIT, and recorded as under LGPL-3\.0-only, and another licence is another yes\. Mend: /],
    ["a bought audit entry with no yes", bought(undefined), /Bark pack: LicenseRef-Vendor-EULA is not on the list for what ships/],
    ["a yes for an audit entry the audit does not hold", bought([ours(), ours({ entry: "Moss pack" })]), /names the audit entry Moss pack, which the audit does not hold\. Mend: take that yes out/],
    ["a yes for an audit entry on its list", (dir) => json("licences.json", (j) => { j.accepted = [ours({ entry: "Bark sounds", licence: "CC0-1.0" })]; })(dir), /the audit entry Bark sounds, which is on its list and needs no yes/],
    ["a yes for an audit entry under no-derivatives terms", bought([ours({ licence: "CC-BY-ND-4.0" })], { ...paid, licence: "CC-BY-ND-4.0" }), /accepted, and under CC-BY-ND-4\.0, terms floor rule 10 never allows/],
    ["a yes for an audit entry under no-derivatives terms by a name the owner gave", bought([ours({ licence: "LicenseRef-NoDerivatives" })], { ...paid, licence: "LicenseRef-NoDerivatives" }), /accepted, and under LicenseRef-NoDerivatives, terms floor rule 10 never allows/],
    ["a yes for an audit entry whose licence no machine can read", bought([ours({ licence: "bought from the vendor" })], { ...paid, licence: "bought from the vendor" }), /which no machine can read/],
    ["an audit entry accepted as a tool, once it ships", bought([ours({ ships: false })]), /Bark pack: accepted as a tool that only runs .*a yes for a tool is no yes for what ships/],
    ["an audit entry accepted under one licence, once the audit records another", bought([ours()], { ...paid, licence: "LicenseRef-Vendor-EULA-2" }), /accepted under LicenseRef-Vendor-EULA, and recorded as under LicenseRef-Vendor-EULA-2, and another licence is another yes/],
    ["an audit entry accepted at one version, once the audit and the script move to the next", (dir) => { json("audit.json", (j) => { Object.assign(j.entries.find((x) => x.name === "mossgrip-cli"), { licence: "LicenseRef-Vendor-EULA", version: "2.0.0" }); })(dir); write("scripts/setup.sh", "npm install -g mossgrip-cli@2.0.0\nnpx --no-install vitest run\nnpm ci\n")(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "mossgrip-cli", version: "1.2.3", ships: false })]; })(dir); }, /mossgrip-cli: LicenseRef-Vendor-EULA is not on the list for tools that only run/],
    ["a yes with no version for an audit entry that has one", (dir) => { json("audit.json", (j) => { j.entries.find((x) => x.name === "mossgrip-cli").licence = "LicenseRef-Vendor-EULA"; })(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "mossgrip-cli", ships: false })]; })(dir); }, /names the audit entry mossgrip-cli, which the audit does not hold\. Mend: take that yes out/],
    ["an accepted audit entry that ships without its notice", bought([ours()], { ...paid, notice: "" }), /Bark pack: it ships, so its notice ships too/],
    ["a yes in \"accepted\" for a NuGet package's audit entry", (dir) => { entry({ name: "Odd.Pkg@1.0.0", kind: "nuget", licence: "LGPL-3.0-only", ships: true, notice: "Odd, LGPL 3.0." })(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "Odd.Pkg@1.0.0", licence: "LGPL-3.0-only" })]; })(dir); }, /a NuGet package's yes stands in "nuget\.accepted", never in "accepted"/],
    ["a yes for an audit entry that says nothing of its licence or whether it ships", bought([{ entry: "Bark pack", yes: said }]), /"accepted" is not in the form it reads/],
    ["a yes for an audit entry given twice", bought([ours(), ours()]), /names one twice: entry Bark pack/],
    ["a yes for an audit entry in a config with no audit", (dir) => { LOCK("MIT")(dir); json("licences.json", (j) => { delete j.audit; delete j.scan; j.accepted = [ours()]; })(dir); }, /names an audit entry, and the config names no "audit"/],
  ]) { const f = run(change); ok(f.some((m) => why.test(m)) && mendSaid(f), `fails on ${what}, each failure saying its mend`, f.join("\n") || "(it passed)"); }
  const twice = run((dir) => { shipped("LGPL-3.0-only", [yes({ ships: false })])(dir); json("package-lock.json", (j) => { j.packages["node_modules/bark-x/node_modules/mossgrip-lib"] = { ...j.packages["node_modules/mossgrip-lib"] }; j.packages["node_modules/bark-x"] = { version: "1.0.0", resolved: "https://registry.npmjs.org/bark-x/-/bark-x-1.0.0.tgz", license: "MIT", dependencies: { "mossgrip-lib": "1.0.0" } }; j.packages[""].dependencies["bark-x"] = "1.0.0"; })(dir); write("package.json", JSON.stringify({ name: "bark", dependencies: { "mossgrip-lib": "1.0.0", "bark-x": "1.0.0" } }))(dir); });
  ok(twice.length === 1, "a package a lockfile holds twice fails once", twice.join("\n"));
}

// Every path the config names, and every file the scan reads, lies inside the project.
{
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "licences-elsewhere-"));
  try {
    fs.writeFileSync(path.join(elsewhere, "audit.json"), JSON.stringify({ entries: [] }));
    fs.writeFileSync(path.join(elsewhere, "notice.js"), "/*! Copyright 2020 Mossgrip | GPL-3.0 */\n");
    const outside = /names a path outside the project/u;
    for (const [what, change] of [
      ["a lockfile named by a path above the project", json("licences.json", (j) => { j.lockfiles = ["../package-lock.json"]; })],
      ["an audit named by a rooted path", json("licences.json", (j) => { j.audit = path.join(elsewhere, "audit.json"); })],
      ["notices named by a path above the project", json("licences.json", (j) => { j.notices = "site/../../NOTICE"; })],
      ["an .npmrc named by a rooted path", json("licences.json", (j) => { j.ignoreScriptsIn = ["/.npmrc"]; })],
    ]) { const f = run(change); ok(f.some((m) => outside.test(m)) && mendSaid(f), `refuses ${what}, saying its mend`, f.join("\n") || "(it passed)"); }
    // (a link to a file needs a right on Windows that is not always there: where it cannot be made, these are not tried)
    let links = true;
    try { fs.symlinkSync(path.join(elsewhere, "notice.js"), path.join(elsewhere, "probe")); } catch { links = false; }
    if (links) {
      const linkedAudit = run((dir) => { fs.rmSync(path.join(dir, "audit.json")); fs.symlinkSync(path.join(elsewhere, "audit.json"), path.join(dir, "audit.json")); });
      ok(linkedAudit.some((m) => outside.test(m)), "refuses an audit reached through a link that leads out of the project", linkedAudit.join("\n"));
      fs.writeFileSync(path.join(elsewhere, "settings.npmrc"), "fund=false\n");
      const linkedNpmrc = run((dir) => fs.symlinkSync(path.join(elsewhere, "settings.npmrc"), path.join(dir, ".npmrc")));
      ok(linkedNpmrc.some((m) => /^\.npmrc is reached through a link that leads out of the project, so it is not read\. Mend: /u.test(m)) && !linkedNpmrc.some((m) => m.includes("fund=false")), "an npm config file reached through a link out of the project is not read, and fails saying its mend", linkedNpmrc.join("\n"));
      fs.writeFileSync(path.join(elsewhere, "package.json"), JSON.stringify({ name: "elsewhere" }));
      const linkedManifest = run((dir) => { LOCK("MIT")(dir); fs.rmSync(path.join(dir, "package.json")); fs.symlinkSync(path.join(elsewhere, "package.json"), path.join(dir, "package.json")); });
      ok(linkedManifest.some((m) => /package\.json is reached through a link that leads out of the project, so it is not read\. Mend: /u.test(m)), "a package.json beside a lockfile reached through a link out of the project is not read, saying its mend", linkedManifest.join("\n"));
      const linkedFile = run((dir) => fs.symlinkSync(path.join(elsewhere, "notice.js"), path.join(dir, "site", "tools", "linked.js")));
      ok(linkedFile.some((m) => /^site\/tools\/linked\.js is a link that leads out of the project, so what it holds cannot be read\. Mend: /u.test(m)) && !linkedFile.some((m) => /carrying a licence notice/u.test(m)), "fails a tracked link that leads out of the project, never reading the file it leads to, saying its mend", linkedFile.join("\n"));
      const inside = run((dir) => { write("docs/vendor.txt", "/*! Copyright 2020 Mossgrip | GPL-3.0 */\n")(dir); fs.symlinkSync(path.join("..", "docs", "vendor.txt"), path.join(dir, "site", "vendor.js")); });
      ok(inside.some((m) => /^site\/vendor\.js \(a file carrying a licence notice\) is not in audit\.json/u.test(m)), "reads a tracked link inside the project as the file it leads to, in the link's own place, a skipped file's notice among them", inside.join("\n"));
    }
  } finally { fs.rmSync(elsewhere, { recursive: true, force: true }); }
}

// A JSON file of any depth or length is read without running out of stack: past the bound, it fails, saying its mend,
// unless an entry audits it by hand.
{
  const deep = `${"[".repeat(20000)}"npx mossgrip-cli@1.2.3"${"]".repeat(20000)}`;
  const nested = run(write("site/tools/deep.json", deep));
  ok(nested.some((m) => /site\/tools\/deep\.json: it nests deeper than 200/u.test(m)) && mendSaid(nested), "fails on JSON nested past the bound, saying its mend", nested.join("\n"));
  const audited = run((dir) => { write("site/tools/deep.json", deep)(dir); handAudited("site/tools/deep.json")(dir); });
  ok(audited.length === 0, "passes JSON nested past the bound that an entry audits by hand", audited.join("\n"));
  const deepLock = run((dir) => { LOCK("MIT")(dir); fs.writeFileSync(path.join(dir, "package-lock.json"), `{"lockfileVersion":3,"packages":{"node_modules/mossgrip-lib":{"version":"1.0.0","license":${"[".repeat(20000)}"MIT"${"]".repeat(20000)}}}}`); });
  ok(deepLock.some((m) => /package-lock\.json cannot be read as JSON \(it nests deeper than 200 objects and lists\)\. Mend: /u.test(m)), "a lock file nested past the bound is refused as JSON that cannot be read, saying its mend", deepLock.join("\n").slice(0, 400));
  const long = run(write("site/tools/long.json", JSON.stringify({ command: Array.from({ length: 150000 }, (_, k) => `arg${k}`) })));
  ok(long.length === 0, "reads a command's list of any length", long.join("\n"));
}

// A program a file downloads by its address is pinned by version and checksum (#488, point 5): read against the pull
// request's base, a file that stood unpinned is reported, and one a pull request adds or unpins fails, saying the mend.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "licence-scan-pins-"));
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
    ok(r.failures.length === 1 && /mosstool, in audit\.json, names no version/u.test(r.failures[0]) && mendSaid(r.failures), "a download a pull request adds to an unpinned file fails, saying the mend", JSON.stringify(r));
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

done();
