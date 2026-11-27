// Tests of the one process that takes the core into a repository (scripts/converge.mjs; #1083), run as a project runs
// it, in projects the starter kit writes from a scratch copy of the core: a new project has nothing more to write, and
// run twice the process changes nothing; a project at a kit from before the marks gets its whole files and its parts of
// AGENTS.md and CLAUDE.md written, every byte outside the parts kept but an import the part holds, or one an earlier
// kit wrote whose path is gone (#1246, point 4); a workflow of the project's own, a file the manifest's "Differences"
// names and a rule file's own lines in a run of imports that holds one are never written over;
// a value out of its form writes nothing and says the mend; the kind is read from the host (whether the repository is
// private: from GitHub's event in a job, from gh, or GitHub's API with no sign-in, in a session: host-private-test.mjs),
// never from the workflows that stand, and with no answer the process writes nothing and says the mend; and the check fails a pull request that makes a file or
// part the core marks other than the core writes it, with its mend, and passes one that changes only what is the
// project's. Git and Node's own modules.
//
//   node tests/converge-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BEGIN, END, converged, partIn, stubOf } from "../scripts/core-owned.mjs";
import { kits, merged, plan } from "../scripts/converge.mjs";
import { kind } from "../scripts/fresh.mjs";
import { privateOf } from "../scripts/host-private.mjs";
import { mended } from "../scripts/mend.mjs";
import { requiredOf } from "../scripts/schemas.mjs";
import { scratch, projectOf } from "../scripts/scratch-core.mjs";
import { project as held } from "../scripts/steps.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const { tmp, env, git, project, fresh } = scratch("converge-test-");
const read = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");
const write = (dir, f, t) => fs.writeFileSync(path.join(dir, f), t);
const converge = (dir, ...args) => { const r = spawnSync(process.execPath, ["core/scripts/converge.mjs", ...args], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = (dir, m) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", m); };

try {
  // ---- a new project: the kit and the process end in the same state ----
  const p = project("an-npm-project", "--owner", "the-owner", "--npm", ".");
  ok(p.status === 0, "the starter kit writes a new project", p.out);
  commit(p.dir, "the kit");
  const first = converge(p.dir, "--write");
  ok(first.status === 0 && first.out.includes("nothing to write") && git(p.dir, "status", "--porcelain") === "", "a new project as the kit writes it: the process has nothing to write", first.out);
  ok(read(p.dir, ".github/workflows/core.yml").startsWith("# The core's file:") && read(p.dir, "AGENTS.md").includes(BEGIN) && read(p.dir, "CLAUDE.md").includes(END), "  the kit marks its workflows and holds the core's part of AGENTS.md and CLAUDE.md between the marks");

  // ---- the kit from before the marks, a project's own words around them ----
  const workflows = fs.readdirSync(path.join(p.dir, ".github/workflows"));
  for (const f of [...workflows.map(w => `.github/workflows/${w}`), ".github/dependabot.yml"]) write(p.dir, f, read(p.dir, f).replace(/^# The core's file:[^\n]*\n/u, ""));
  for (const f of ["AGENTS.md", "CLAUDE.md"]) write(p.dir, f, read(p.dir, f).replace(`${BEGIN}\n`, "").replace(`${END}\n`, ""));
  write(p.dir, "CLAUDE.md", `${read(p.dir, "CLAUDE.md")}\nA line of the project's own.\n`);
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace("## Commands", "## Commands, as the project words them"));
  write(p.dir, ".github/workflows/look.yml", `${read(p.dir, ".github/workflows/look.yml")}# a line of the project's own\n`);
  commit(p.dir, "as a kit from before the marks wrote it, and the project's own words");
  const old = { claude: read(p.dir, "CLAUDE.md"), agents: read(p.dir, "AGENTS.md"), look: read(p.dir, ".github/workflows/look.yml") };
  const taken = converge(p.dir, "--write");
  const agents = read(p.dir, "AGENTS.md"), claude = read(p.dir, "CLAUDE.md");
  ok(taken.status === 0 && /written[\s\S]*AGENTS\.md, CLAUDE\.md[\s\S]*\.github\/workflows\/core\.yml/.test(taken.out) && read(p.dir, ".github/workflows/core.yml").startsWith("# The core's file:"),
    "a project at a kit from before the marks: its whole files are written with the core's mark, and its parts of the rule files", taken.out);
  ok(agents.replace(`${BEGIN}\n`, "").replace(`${END}\n`, "") === old.agents && claude.replace(`${BEGIN}\n`, "").replace(`${END}\n`, "") === old.claude && claude.includes(`${END}\n\nA line of the project's own.`),
    "  every byte outside the core's part stays as it stood");
  ok(read(p.dir, ".github/workflows/look.yml") === old.look && /Left as the project's[\s\S]*look\.yml is not the core's/.test(taken.out), "  a workflow the project changed is not the core's: left as it stands and named as a difference", taken.out);
  commit(p.dir, "the process");
  const again = converge(p.dir, "--write");
  ok(again.out.includes("nothing to write") && git(p.dir, "status", "--porcelain") === "", "  run again, it changes nothing", again.out);
  // (a workflow of the core's whose check the one job of the core.yml the process ends with runs, as a private project's
  // core.yml folds the calls its earlier kit wrote: taken out where it carries the core's mark or is, mark and pins
  // aside, an earlier kit's text; one whose check the one job does not run, one the project changed, and every one
  // where core.yml is named in "Differences", stay; #1101, point 2)
  {
    const wf = f => `.github/workflows/${f}.yml`, earlier = `name: x\njobs:\n  x:\n    uses: the-core/.github/workflows/x.yml@${"a".repeat(40)}\n`;
    const folds = `${read(p.dir, wf("core"))}    with:\n      copies: checks/copies.json\n      description: true\n      signatures: "."\n`;
    write(p.dir, wf("copies"), earlier.replace("a".repeat(40), "b".repeat(40)));
    write(p.dir, wf("pr-description"), `${read(p.dir, wf("core")).split("\n")[0]}\nname: y\n`);
    write(p.dir, wf("signatures"), `${earlier}# a line of the project's own\n`);
    write(p.dir, wf("nuget"), earlier);
    const q = held(p.dir), { kit } = kits(q, null), one = kit.map(([to, t]) => [to, to === wf("core") ? folds : t]).filter(([to]) => !["copies", "pr-description", "signatures", "nuget"].map(wf).includes(to));
    const older = [[wf("copies"), wf("pr-description"), wf("signatures"), wf("nuget"), wf("licences")].map(f => [f, earlier])];
    const r = plan(q, one, older);
    ok(r.remove.map(x => x.to).sort().join() === [wf("copies"), wf("pr-description")].sort().join() && r.write.some(w => w.to === wf("core")),
      "a workflow of the core's whose check the one job of the core.yml written runs is taken out, where it carries the core's mark or is an earlier kit's text, its pins aside; one the project changed, and one the one job does not run, stay", JSON.stringify(r.remove));
    const untouched = plan(q, kit, older);
    ok(!untouched.remove.length, "  where the core.yml the process ends with folds none, nothing is taken out, though an earlier kit wrote the file", JSON.stringify(untouched.remove));
    write(p.dir, wf("core"), folds.replace(/\n/g, "\r\n"));
    const crlf = plan(held(p.dir), one, older);
    ok(crlf.remove.map(x => x.to).sort().join() === [wf("copies"), wf("pr-description")].sort().join() && !crlf.write.some(w => w.to === wf("core")),
      "  and where core.yml already stands as written, its line ends alone otherwise (CRLF, as a checkout on Windows holds it), the same are taken out and core.yml is not written", JSON.stringify(crlf));
    git(p.dir, "checkout", "-q", "--", wf("core"));
    write(p.dir, "core-manifest.md", read(p.dir, "core-manifest.md").replace(/^## Differences\r?\n+None\./m, `## Differences\n\n- "${wf("core")}": the project's own, on the owner's word.`));
    const declared = plan(held(p.dir), one, older);
    ok(!declared.remove.length, "  nor where core.yml is named in \"Differences\", so its one job is never written", JSON.stringify(declared.remove));
    for (const f of ["copies", "pr-description", "signatures", "nuget"]) fs.rmSync(path.join(p.dir, wf(f)));
    git(p.dir, "checkout", "-q", "--", "core-manifest.md");
  }
  // (a run from before the marks that the project took an import out of: written as the kit writes it, and named)
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace(`${BEGIN}\n`, "").replace(`${END}\n`, "").replace("@core/roles/shared/inbox.md\n", ""));
  const back = converge(p.dir, "--write");
  ok(read(p.dir, "AGENTS.md").includes(`${BEGIN}\n`) && read(p.dir, "AGENTS.md").includes("@core/roles/shared/inbox.md\n") && /Left as the project's[\s\S]*AGENTS\.md held a run of the kit's imports that no kit writes as it stood/.test(back.out),
    "  a run of the kit's imports the project took one out of is written as the kit writes it, and named", back.out);
  git(p.dir, "checkout", "-q", "--", ".");

  // ---- what is the project's is never written ----
  write(p.dir, "core-manifest.md", read(p.dir, "core-manifest.md").replace(/^## Differences\r?\n+None\./m, '## Differences\n\n- ".github/workflows/delete-merged-branches.yml": kept as the project\'s own, on the owner\'s word.'));
  fs.rmSync(path.join(p.dir, ".github/workflows/delete-merged-branches.yml"));
  write(p.dir, "CLAUDE.md", "# Claude's part\n\n@AGENTS.md\n@docs/the-project-s-own.md\n@core/tools/claude.md\n");
  commit(p.dir, "a difference declared, and a run of imports with a line of the project's own");
  const own = converge(p.dir, "--write");
  ok(!fs.existsSync(path.join(p.dir, ".github/workflows/delete-merged-branches.yml")), "a file the manifest's \"Differences\" names is the project's: never written", own.out);
  const claudeMd = read(p.dir, "CLAUDE.md");
  ok(claudeMd.startsWith("# Claude's part\n\n@docs/the-project-s-own.md\n\n") && claudeMd.endsWith(`${END}\n`) && claudeMd.split("@AGENTS.md\n").length === 2 && /CLAUDE\.md held @AGENTS\.md, @core\/tools\/claude\.md outside the core's part/.test(own.out),
    "  a run of imports that holds a line of the project's own keeps that line, the kit's lines taken out of it and named, and the core's part goes after it, each import once (#1246, point 4)", `${claudeMd}\n${own.out}`);
  // (an import of an earlier layout, which an earlier kit wrote and whose path is gone, is taken out; one whose path is there, kept)
  {
    const want = `# C\n\n${BEGIN}\n@AGENTS.md\n@core/tools/claude.md\n${END}\n`, earlier = "# C\n\n@AGENTS.md\n@core/modules/claude.md\n", stood = "# C\n\n@AGENTS.md\n@core/modules/claude.md\n@docs/own.md\n";
    const gone = converged("CLAUDE.md", stood, want, [earlier], f => f === "docs/own.md"), kept = converged("CLAUDE.md", stood, want, [earlier], () => true);
    ok(gone.text === `# C\n\n@docs/own.md\n\n${BEGIN}\n@AGENTS.md\n@core/tools/claude.md\n${END}\n` && /held @AGENTS\.md, @core\/modules\/claude\.md/.test(gone.left) && !Object.keys(converged("CLAUDE.md", gone.text, want, [earlier], f => f === "docs/own.md")).length,
      "  an import an earlier kit wrote whose path is gone is taken out with it, and run again nothing changes", JSON.stringify(gone));
    ok(kept.text?.includes("@core/modules/claude.md\n@docs/own.md\n") && kept.text.split("@AGENTS.md").length === 2, "  and one whose path is there is the project's, kept", JSON.stringify(kept));
    ok(!Object.keys(converged("CLAUDE.md", `${want}~~~\n\`\`\`\n@AGENTS.md\n~~~\n`, want, [earlier], () => false)).length, "  and a line of a fenced example is no import: kept");
    ok(!Object.keys(converged("CLAUDE.md", `~~~\n${want}@core/modules/claude.md\n~~~\n`, want, [earlier], () => false)).length, "  so is one round the part");
    // (an import of a moved stub whose every target the part imports counts as replaced, wherever it came from; one
    // whose target the part does not import, kept: #1272, point 2)
    const stub = f => ({ "core/modules/claude.md": ["core/tools/claude.md"], "core/modules/x.md": ["core/tools/x.md"] })[f] ?? null;
    const stubbed = converged("CLAUDE.md", `# C\n\n@core/modules/claude.md\n@core/modules/x.md\n\n${want.slice(5)}`, want, [], () => true, stub);
    ok(stubbed.text === `# C\n\n@core/modules/x.md\n\n${want.slice(5)}` && /held @core\/modules\/claude\.md outside/.test(stubbed.left ?? ""),
      "  an import of a moved stub whose target the part imports is taken out and named, one whose target it does not, kept (#1272, point 2)", JSON.stringify(stubbed));
    // (a stub is its pointers alone: one that holds a line of its own beside them is read as no stub, so it is kept)
    const pointer = "# Moved: Claude's part\n\n[`tools/claude.md`](../tools/claude.md) holds these rules now: read it whole.\n\n@../tools/claude.md\n";
    ok(JSON.stringify(stubOf(() => pointer, ".", "core/modules/claude.md")) === '["core/tools/claude.md"]' && stubOf(() => `${pointer}\nNever push on a Friday.\n`, ".", "core/modules/claude.md") === null,
      "  a moved stub is read as one only where it holds its pointers and nothing else", String(stubOf(() => `${pointer}\nNever push on a Friday.\n`, ".", "core/modules/claude.md")));
  }
  ok(partIn("@a.md\n\n@b.md\n", new Set(["@a.md", "@b.md"])) === "many" && partIn(`${BEGIN}\n${BEGIN}\n${END}\n`, new Set()) === "many", "  where it cannot tell which run of imports is the core's, it says so, and takes none");
  git(p.dir, "checkout", "-q", "--", ".");
  // (the trial's case on the core's own stub: CLAUDE.md that imports core/modules/claude.md above the part, which pulls
  // in what the part's core/tools/claude.md is, loses it; core/modules/git.md, whose target CLAUDE.md's part does not
  // import, stays: #1272, point 2)
  {
    const kitText = read(p.dir, "core/setup/template/CLAUDE.md.tmpl");
    write(p.dir, "CLAUDE.md", kitText.replace(BEGIN, `@core/modules/claude.md\n@core/modules/git.md\n${BEGIN}`));
    const stubbed = converge(p.dir, "--write");
    ok(read(p.dir, "CLAUDE.md") === kitText.replace(BEGIN, `@core/modules/git.md\n${BEGIN}`) && /CLAUDE\.md held @core\/modules\/claude\.md outside the core's part/.test(stubbed.out),
      "  the one process takes out an import of the core's moved stub whose target the part imports, and names it; a stub whose target it does not import stays", `${read(p.dir, "CLAUDE.md")}\n${stubbed.out}`);
    git(p.dir, "checkout", "-q", "--", ".");
    // (a file of the project's own that opens as a stub does is no stub of the core's: its import stays)
    fs.mkdirSync(path.join(p.dir, "docs"), { recursive: true });
    write(p.dir, "docs/deploy.md", "# Moved: our deploy notes now open with the rules below\n\nNever deploy on a Friday.\n\n@../AGENTS.md\n");
    write(p.dir, "CLAUDE.md", kitText.replace(BEGIN, `@docs/deploy.md\n${BEGIN}`));
    git(p.dir, "add", "docs/deploy.md");
    const own = converge(p.dir, "--write");
    ok(read(p.dir, "CLAUDE.md") === kitText.replace(BEGIN, `@docs/deploy.md\n${BEGIN}`), "  a file of the project's own that opens \"# Moved:\" is no stub of the core's: its import stays", `${read(p.dir, "CLAUDE.md")}\n${own.out}`);
    git(p.dir, "rm", "-q", "--cached", "docs/deploy.md"); fs.rmSync(path.join(p.dir, "docs/deploy.md"));
    git(p.dir, "checkout", "-q", "--", ".");
  }

  // ---- a value out of its form ----
  const named = read(p.dir, "AGENTS.md");
  write(p.dir, "AGENTS.md", named.replace(/^# .*$/m, "# @evil.md"));
  write(p.dir, ".github/workflows/core.yml", "name: core\n");
  const refused = converge(p.dir, "--write");
  ok(refused.status === 1 && refused.out.includes("AGENTS.md's first heading") && mended(refused.out) && read(p.dir, ".github/workflows/core.yml") === "name: core\n",
    "a value that lands in a file out of its form: the process writes nothing and says the mend", refused.out);
  git(p.dir, "checkout", "-q", "--", ".");

  // ---- the kind, read from the host and never guessed from the workflows that stand (#1095, point 1) ----
  ok(kind(held(p.dir), { private: true }).o.private === true, "a repository the host says is private is read as private, though it holds the CodeQL and licence workflows");
  for (const f of ["codeql.yml", "licences.yml"]) fs.rmSync(path.join(p.dir, ".github/workflows", f));
  ok(kind(held(p.dir), { private: true }).o.private === true && kind(held(p.dir), { private: false }).o.private === undefined,
    "  a private repository with no CodeQL workflow read as private, and a public one with none read as public");
  const unanswered = kind(held(p.dir), privateOf(p.dir, { env: {}, ask: () => { throw new Error("not asked"); } }));
  ok(unanswered.o.private === undefined && /could not be read[\s\S]*Mend:/.test(unanswered.unread), "  where the clone's origin names no repository on GitHub, it says it could not read it, with the mend, and guesses nothing", unanswered.unread);
  const plainEnv = { ...env, CORE_HOST_ANSWERS: "" };
  const blind = spawnSync(process.execPath, ["core/scripts/converge.mjs", "--write"], { cwd: p.dir, env: plainEnv, encoding: "utf8" });
  ok(blind.status === 1 && /FAIL whether the repository is private could not be read/.test(`${blind.stdout}${blind.stderr}`) && mended(`${blind.stdout}${blind.stderr}`) && !fs.existsSync(path.join(p.dir, ".github/workflows/codeql.yml")),
    "  and the process, given no answer, writes nothing and says the mend", `${blind.stdout}${blind.stderr}`);
  const compared = spawnSync(process.execPath, ["core/scripts/fresh.mjs"], { cwd: p.dir, env: plainEnv, encoding: "utf8" });
  ok(compared.status === 0 && /not compared, since whether the repository is private could not be read/.test(compared.stdout), "  nor is the project compared with a fresh start", compared.stdout);
  git(p.dir, "checkout", "-q", "--", ".");

  // ---- a path the manifest places outside the project (floor rule 13) ----
  const placed = read(p.dir, "core-manifest.md");
  write(p.dir, "core-manifest.md", placed.replace("| *mutation tool* |", "| *shape check* | `../escaped-shape.json` |\n| *mutation tool* |"));
  const escaped = converge(p.dir, "--write");
  ok(read(p.dir, "core-manifest.md").includes("../escaped-shape.json") && !fs.existsSync(path.join(p.dir, "..", "escaped-shape.json")) && escaped.status === 1 && /FAIL \.\.\/escaped-shape\.json, where core-manifest\.md places a file the kit writes, lies outside the project/.test(escaped.out) && mended(escaped.out),
    "a file the manifest places outside the project is never written: the process writes nothing and says the mend", escaped.out);
  git(p.dir, "checkout", "-q", "--", ".");

  // ---- the check, on a pull request ----
  git(p.dir, "branch", "-f", "base");
  const check = () => converge(p.dir, "--check", "--base", "base");
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace("## Commands", "## Commands, worded again"));
  commit(p.dir, "outside the part");
  const outside = check();
  ok(outside.status === 0, "the check passes a pull request that changes only what is the project's", outside.out);
  write(p.dir, ".github/workflows/core.yml", read(p.dir, ".github/workflows/core.yml").replace(/\n/g, "\r\n"));
  commit(p.dir, "line ends alone");
  const ends = check();
  ok(ends.status === 0, "  and one that changes a file the core marks in its line ends alone (CRLF, as a checkout on Windows holds it)", ends.out);
  git(p.dir, "branch", "-f", "base"); // (the base now holds core.yml with CRLF line ends: a change past them is still the pull request's)
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace("@core/roles/builder.md\n", ""));
  write(p.dir, ".github/workflows/core.yml", `${read(p.dir, ".github/workflows/core.yml")}# more\n`);
  commit(p.dir, "inside the part, and a marked workflow");
  const inside = check();
  ok(inside.status === 1 && /FAIL AGENTS\.md: the core's part of it/.test(inside.out) && /FAIL \.github\/workflows\/core\.yml: the core's file/.test(inside.out) && mended(inside.out, { from: projectOf() }),
    "  and fails one that makes a file or part the core marks other than the core writes it, with its mend", inside.out);
  // (main's part, or a marked file, already stale: a pull request that leaves the part as it was, or does not bring the
  // file back, is not failed for what stood before it; it is reported with the mend)
  git(p.dir, "branch", "-f", "stale");
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace("## Commands, worded again", "## Commands, worded a third time"));
  write(p.dir, ".github/workflows/core.yml", `${read(p.dir, ".github/workflows/core.yml")}# and more\n`);
  commit(p.dir, "outside the stale part, and the stale workflow again");
  const stood = converge(p.dir, "--check", "--base", "stale");
  ok(stood.status === 0 && /AGENTS\.md: the core's part of it stood otherwise[^\n]*reported, not failed\. Mend/.test(stood.out) && /\.github\/workflows\/core\.yml: the core's file stood otherwise/.test(stood.out),
    "  and passes, reporting it, one whose base already held the part or the file otherwise, where the part is left as it was", stood.out);
  git(p.dir, "reset", "-q", "--hard", "stale");
  const env2 = spawnSync(process.execPath, ["core/scripts/converge.mjs"], { cwd: p.dir, env: { ...env, CONVERGE_BASE: "base" }, encoding: "utf8" });
  ok(env2.status === 1, "  as the copies part of checks.mjs runs it, its base in CONVERGE_BASE", `${env2.stdout}${env2.stderr}`);
  const noBase = spawnSync(process.execPath, ["core/scripts/converge.mjs"], { cwd: p.dir, env: { ...env, CONVERGE_BASE: "" }, encoding: "utf8" });
  ok(noBase.status === 0 && noBase.stdout.includes("on a pull request alone"), "  with no base (a push to main), it reads nothing and fails nothing", noBase.stdout);
  // ---- the key merge (`merged`; #1095, point 5): a key whose absence its check fails is never added, and a path two
  // checks' configs name is merged by neither ----
  const m = project("a-merge-project", "--owner", "the-owner", "--npm", "."), lic = JSON.parse(read(m.dir, "checks/licences.json"));
  write(m.dir, "checks/licences-audit.json", "{}\n");
  commit(m.dir, "an audit with no entries");
  ok(!merged(m.dir, new Set()).some(r => r.wrote) && read(m.dir, "checks/licences-audit.json") === "{}\n", "the key merge never adds the audit's \"entries\", whose absence its check fails");
  delete lic.ships;
  delete lic.scan.served;
  write(m.dir, "checks/licences.json", JSON.stringify({ ...lic, audit: "checks/licences.json" }));
  commit(m.dir, "the licences file named as its own audit");
  const both = merged(m.dir, new Set());
  ok(!both.some(r => r.wrote) && both.filter(r => r.why?.includes("`checks/licences.json` is named as the config of two checks")).length === 1 && !("ships" in JSON.parse(read(m.dir, "checks/licences.json"))),
    "  and a file named as the licence config and its audit is left as it is, the report saying why once", JSON.stringify(both));
  const asks = requiredOf("licences");
  ok(asks.required.includes("ships") && asks.required.includes("audit") && asks.keys.scan.required.includes("served"), "  the keys a check asks are read from its schema, at each depth and from its dependencies", JSON.stringify(asks));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${count - failed} of ${count} assertions on the one process passed`);
if (failed) process.exitCode = 1;
