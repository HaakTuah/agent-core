// Tests of the one process that takes the core into a repository (scripts/converge.mjs; #1083), run as a project runs
// it, in projects the starter kit writes from a scratch copy of the core: a new project has nothing more to write, and
// run twice the process changes nothing; a project at a kit from before the marks gets its whole files and its parts of
// AGENTS.md and CLAUDE.md written, every byte outside the parts kept; a workflow of the project's own, a file the
// manifest's "Differences" names and a rule file whose run of imports holds a line of its own are never written over;
// a value out of its form writes nothing and says the mend; and the check fails a pull request that makes a file or
// part the core marks other than the core writes it, with its mend, and passes one that changes only what is the
// project's. Git and Node's own modules.
//
//   node tests/converge-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BEGIN, END, partIn } from "../scripts/core-owned.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratch } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const { tmp, env, git, project } = scratch("converge-test-");
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

  // ---- what is the project's is never written ----
  write(p.dir, "core-manifest.md", read(p.dir, "core-manifest.md").replace(/^## Differences\r?\n+None\./m, '## Differences\n\n- ".github/workflows/delete-merged-branches.yml": kept as the project\'s own, on the owner\'s word.'));
  fs.rmSync(path.join(p.dir, ".github/workflows/delete-merged-branches.yml"));
  write(p.dir, "CLAUDE.md", "# Claude's part\n\n@AGENTS.md\n@docs/the-project-s-own.md\n@core/tools/claude.md\n");
  commit(p.dir, "a difference declared, and a run of imports with a line of the project's own");
  const own = converge(p.dir, "--write");
  ok(!fs.existsSync(path.join(p.dir, ".github/workflows/delete-merged-branches.yml")), "a file the manifest's \"Differences\" names is the project's: never written", own.out);
  ok(read(p.dir, "CLAUDE.md").startsWith("# Claude's part\n\n@AGENTS.md\n@docs/the-project-s-own.md\n@core/tools/claude.md\n") && read(p.dir, "CLAUDE.md").endsWith(`${END}\n`),
    "  a run of imports that holds a line of the project's own stays whole, and the core's part goes after it", read(p.dir, "CLAUDE.md"));
  ok(partIn("@a.md\n\n@b.md\n", new Set(["@a.md", "@b.md"])) === "many" && partIn(`${BEGIN}\n${BEGIN}\n${END}\n`, new Set()) === "many", "  where it cannot tell which run of imports is the core's, it says so, and takes none");
  git(p.dir, "checkout", "-q", "--", ".");

  // ---- a value out of its form ----
  const named = read(p.dir, "AGENTS.md");
  write(p.dir, "AGENTS.md", named.replace(/^# .*$/m, "# @evil.md"));
  write(p.dir, ".github/workflows/core.yml", "name: core\n");
  const refused = converge(p.dir, "--write");
  ok(refused.status === 1 && refused.out.includes("AGENTS.md's first heading") && mended(refused.out) && read(p.dir, ".github/workflows/core.yml") === "name: core\n",
    "a value that lands in a file out of its form: the process writes nothing and says the mend", refused.out);
  git(p.dir, "checkout", "-q", "--", ".");

  // ---- the check, on a pull request ----
  git(p.dir, "branch", "-f", "base");
  const check = () => converge(p.dir, "--check", "--base", "base");
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace("## Commands", "## Commands, worded again"));
  commit(p.dir, "outside the part");
  const outside = check();
  ok(outside.status === 0, "the check passes a pull request that changes only what is the project's", outside.out);
  write(p.dir, "AGENTS.md", read(p.dir, "AGENTS.md").replace("@core/roles/builder.md\n", ""));
  write(p.dir, ".github/workflows/core.yml", `${read(p.dir, ".github/workflows/core.yml")}# more\n`);
  commit(p.dir, "inside the part, and a marked workflow");
  const inside = check();
  ok(inside.status === 1 && /FAIL AGENTS\.md: the core's part of it/.test(inside.out) && /FAIL \.github\/workflows\/core\.yml: the core's file/.test(inside.out) && mended(inside.out),
    "  and fails one that makes a file or part the core marks other than the core writes it, with its mend", inside.out);
  const env2 = spawnSync(process.execPath, ["core/scripts/converge.mjs"], { cwd: p.dir, env: { ...env, CONVERGE_BASE: "base" }, encoding: "utf8" });
  ok(env2.status === 1, "  as the copies part of checks.mjs runs it, its base in CONVERGE_BASE", `${env2.stdout}${env2.stderr}`);
  const noBase = spawnSync(process.execPath, ["core/scripts/converge.mjs"], { cwd: p.dir, env: { ...env, CONVERGE_BASE: "" }, encoding: "utf8" });
  ok(noBase.status === 0 && noBase.stdout.includes("on a pull request alone"), "  with no base (a push to main), it reads nothing and fails nothing", noBase.stdout);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${count - failed} of ${count} assertions on the one process passed`);
if (failed) process.exitCode = 1;
