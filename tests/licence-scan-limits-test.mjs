// Checks what the licence scan (scripts/licence-scan.mjs) reads on the staged project (licence-scan-stage.mjs): every path
// the config names, and every file the scan reads, held to the project; JSON of any depth or length read without
// running out of stack; and code nested past what the readers follow failed with its mend. The scan's other cases are
// licence-scan-test.mjs's. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/licence-scan-limits-test.mjs
import { LOCK, done, entry, handAudited, json, asOutput, ok, run, write } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import fs from "node:fs";
import path from "node:path";
import { scratchDir } from "../scripts/scratch-core.mjs";

// Every path the config names, and every file the scan reads, lies inside the project.
{
  const elsewhere = scratchDir("licences-elsewhere-");
  try {
    fs.writeFileSync(path.join(elsewhere, "audit.json"), JSON.stringify({ entries: [] }));
    fs.writeFileSync(path.join(elsewhere, "notice.js"), "/*! Copyright 2020 Mossgrip | GPL-3.0 */\n");
    const outside = /names a path outside the project/u;
    for (const [what, change] of [
      ["a lockfile named by a path above the project", json("licences.json", (j) => { j.lockfiles = ["../package-lock.json"]; })],
      ["an audit named by a rooted path", json("licences.json", (j) => { j.audit = path.join(elsewhere, "audit.json"); })],
      ["notices named by a path above the project", json("licences.json", (j) => { j.notices = "site/../../NOTICE"; })],
      ["an .npmrc named by a rooted path", json("licences.json", (j) => { j.ignoreScriptsIn = ["/.npmrc"]; })],
    ]) { const f = run(change); ok(f.some((m) => outside.test(m)) && mended(asOutput(f)), `refuses ${what}, saying its mend`, f.join("\n") || "(it passed)"); }
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
      // (a tracked link to a folder inside the project: its files are read in their own place, and the link fails with its
      // mend, never with the error a read of a folder throws; #447)
      const folder = run((dir) => { write("docs/vendor.txt", "x\n")(dir); fs.symlinkSync(path.join("..", "docs"), path.join(dir, "site", "docs-link")); });
      ok(folder.some((m) => /^site\/docs-link is a link to no file of bytes \(a folder, a device or a pipe\)/u.test(m)) && mended(asOutput(folder.filter((m) => m.startsWith("site/docs-link")))) && !folder.some((m) => /EISDIR/u.test(m)),
        "fails a tracked link to a folder inside the project with its mend, never with EISDIR", folder.join("\n"));
    }
  } finally { fs.rmSync(elsewhere, { recursive: true, force: true }); }
}

// A JSON file of any depth or length is read without running out of stack: past the bound, it fails, saying its mend,
// unless an entry audits it by hand.
{
  const deep = `${"[".repeat(20000)}"npx mossgrip-cli@1.2.3"${"]".repeat(20000)}`;
  const nested = run(write("site/tools/deep.json", deep));
  ok(nested.some((m) => /site\/tools\/deep\.json: it nests deeper than 200/u.test(m)) && mended(asOutput(nested)), "fails on JSON nested past the bound, saying its mend", nested.join("\n"));
  const audited = run((dir) => { write("site/tools/deep.json", deep)(dir); handAudited("site/tools/deep.json")(dir); });
  ok(audited.length === 0, "passes JSON nested past the bound that an entry audits by hand", audited.join("\n"));
  const deepLock = run((dir) => { LOCK("MIT")(dir); fs.writeFileSync(path.join(dir, "package-lock.json"), `{"lockfileVersion":3,"packages":{"node_modules/mossgrip-lib":{"version":"1.0.0","license":${"[".repeat(20000)}"MIT"${"]".repeat(20000)}}}}`); });
  ok(deepLock.some((m) => /package-lock\.json cannot be read as JSON \(it nests deeper than 200 objects and lists\)\. Mend: /u.test(m)), "a lock file nested past the bound is refused as JSON that cannot be read, saying its mend", deepLock.join("\n").slice(0, 400));
  const long = run(write("site/tools/long.json", JSON.stringify({ command: Array.from({ length: 150000 }, (_, k) => `arg${k}`) })));
  ok(long.length === 0, "reads a command's list of any length", long.join("\n"));
}

// Code whose strings and templates nest past what the readers can follow fails, named, saying its mend, and the rest of
// the project is still read (#1496), whether they are left open or closed, and in a file an entry audits by hand too.
{
  const clone = 'import { execFileSync } from "node:child_process";\nexecFileSync("git", ["clone", ';
  const too = /^site\/tools\/deep\.js nests its strings, templates or brackets too deep for the scan to read, so what it fetches cannot be read\. Mend: /u;
  for (const [what, text] of [["left open", `${clone}${"`${".repeat(50000)}\n`], ["closed", `${clone}${"`${".repeat(50000)}a${"}`".repeat(50000)}]);\n`]]) {
    const f = run((dir) => { write("site/tools/deep.js", text)(dir); write("site/tools/other.js", "/*! Copyright 2020 Mossgrip | GPL-3.0 */\n")(dir); });
    ok(f.some((m) => too.test(m)) && mended(asOutput(f.filter((m) => too.test(m)))) && f.some((m) => m.startsWith("site/tools/other.js")) && !f.some((m) => /call stack/u.test(m)),
      `fails on strings and templates nested too deep, ${what}, naming the file and saying its mend, and reads the rest`, f.join("\n").slice(0, 600));
  }
  const audited = run((dir) => { write("site/tools/deep.js", `${clone}${"`${".repeat(50000)}\n`)(dir); handAudited("site/tools/deep.js")(dir); });
  ok(audited.some((m) => too.test(m)), "fails so in a file an entry audits by hand too", audited.join("\n").slice(0, 600));
}

done();
