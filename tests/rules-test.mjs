// Tests rulesAt (scripts/rules.mjs; #812): the rules of a commit are read from git once for each root, commit id and
// `agents`, since the staged cases set from one commit read it once for each case (staged.mjs, fingerprints); a name
// that moves (HEAD, a branch, one written like an id) is read again, as it names another commit; and what a caller does
// with the rules it was given changes none that is asked after. The git it reads is handed in, a fake that answers
// from a table of commits and counts what it was asked, so no repository is made; one case reads the core's own
// repository with the git it runs by itself. And the rules a project takes (takenRules), as the reading of a project
// against the core reads them against its record (core-reading.mjs; #464): a whole reading where no record stands or
// it cannot be read, else each rule added or changed since, by its key. Node's own modules.
//
//   node tests/rules-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECORD, due, main, record, said } from "../scripts/core-reading.mjs";
import { mended } from "../scripts/mend.mjs";
import { ROOT, rulesAt, takenRules, rules } from "../scripts/rules.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const ID = n => String(n).repeat(40);
// (a repository: commits by id, each its files; names by what they point at; and a count of the file reads)
const repository = (commits, names = {}) => {
  const asked = { show: 0, list: 0 };
  const git = (...args) => {
    const [command, ...rest] = args;
    if (command === "rev-parse") {
      const name = rest.at(-1).replace(/\^\{commit\}$/u, "");
      const id = names[name] ?? (commits[name] ? name : null);
      if (!id) throw new Error(`unknown revision ${name}`);
      return `${id}\n`;
    }
    if (command === "ls-tree") {
      asked.list++;
      const files = Object.keys(commits[rest.find(a => commits[a])]);
      return rest.includes("AGENTS.md") ? files.filter(f => f === "AGENTS.md").join("\n") : files.filter(f => f !== "AGENTS.md").join("\n");
    }
    if (command === "show") { asked.show++; const [id, file] = rest[0].split(":"); return commits[id][file]; }
    throw new Error(`unexpected ${args.join(" ")}`);
  };
  return { git, asked };
};
const leads = rs => rs.map(r => r.lead).join();
const one = "tasks/a.md";
const A = ID("a"), B = ID("b"), C = ID("c");
const commits = {
  [A]: { [one]: "- **Rule one.** Its text.\n" },
  [B]: { [one]: "- **Rule one.** Its text.\n- **Rule two.** More.\n", "AGENTS.md": "- **Own rule.** Here.\n" },
  [C]: { [one]: "- **Rule three.** Last.\n" },
};

{
  const { git, asked } = repository(commits);
  ok(leads(rulesAt("/r1", A, { git })) === "Rule one" && leads(rulesAt("/r1", B, { git })) === "Rule one,Rule two" && leads(rulesAt("/r1", A, { git })) === "Rule one",
    "the rules of two commits of one repository are each its own, in either order they are asked");
  const reads = asked.show;
  rulesAt("/r1", A, { git }); rulesAt("/r1", B, { git });
  ok(asked.show === reads, "a commit asked again is not read again");
}
{
  const { git } = repository(commits);
  const first = rulesAt("/r2", A, { git });
  first[0].text = "changed by a caller"; first.pop();
  ok(rulesAt("/r2", A, { git }).length === 1 && rulesAt("/r2", A, { git })[0].text === "- **Rule one.** Its text.", "what a caller does with the first answer it was given changes none that is asked after");
  const later = rulesAt("/r2", A, { git });
  later[0].text = "changed again";
  ok(rulesAt("/r2", A, { git })[0].text === "- **Rule one.** Its text.", "nor what it does with a later one");
}
{
  const { git } = repository(commits);
  ok(leads(rulesAt("/r3", B, { git })) === "Rule one,Rule two" && leads(rulesAt("/r3", B, { git, agents: true })) === "Own rule,Rule one,Rule two" && leads(rulesAt("/r3", B, { git })) === "Rule one,Rule two",
    "a commit asked with its AGENTS.md and without are each their own");
}
{
  const other = repository({ [A]: { [one]: "- **Elsewhere.** Another repository, the same id.\n" } });
  const { git } = repository(commits);
  ok(leads(rulesAt("/r4", A, { git })) === "Rule one" && leads(rulesAt("/r5", A, { git: other.git })) === "Elsewhere" && leads(rulesAt("/r4", A, { git })) === "Rule one",
    "the same id in two repositories gives each its own rules");
}
{
  const names = { HEAD: A, ["f".repeat(64)]: A, "main": A };
  const { git, asked } = repository(commits, names);
  const before = leads(rulesAt("/r6", "HEAD", { git }));
  const lists = asked.list;
  Object.assign(names, { HEAD: C, ["f".repeat(64)]: B, main: B });
  ok(before === "Rule one" && leads(rulesAt("/r6", "HEAD", { git })) === "Rule three" && asked.list > lists, "a name that moves (HEAD) is read again, and gives the commit it names now");
  ok(leads(rulesAt("/r6", "f".repeat(64), { git })) === "Rule one,Rule two" && leads(rulesAt("/r6", "main", { git })) === "Rule one,Rule two" && leads(rulesAt("/r6", A, { git })) === "Rule one",
    "so does a name written like an id, and a name beside the id it once named is not mistaken for it");
  let thrown = null;
  try { rulesAt("/r6", "nothing-such", { git }); } catch (e) { thrown = e; }
  ok(thrown !== null, "a name that is no commit is no rules");
}
{
  // (the git it runs by itself, on the core's own commit: the floor's first rule, and AGENTS.md's rules only where asked)
  const floor = "floor/security.md: 1. Nothing secret in the repository";
  const without = rulesAt(ROOT, "HEAD"), within = rulesAt(ROOT, "HEAD", { agents: true });
  ok(without.some(r => r.key === floor) && !without.some(r => r.file === "AGENTS.md") && within.some(r => r.key === floor) && within.some(r => r.file === "AGENTS.md"),
    "its own git reads the core's commit: the floor's rules, and those of AGENTS.md where asked");
}
// the rules a project takes, and what a reading against the core finds due
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-reading-"));
  const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), t); };
  write("floor/security.md", "**1. Nothing secret.** None.\n");
  write("tasks/a.md", "- **Rule one.** Its text.\n");
  write("tasks/b.md", "- **Rule two.** Left out.\n");
  const manifest = "Modules: `a.md`\nNot taken: `b.md` (none here)\n";
  ok(takenRules(rules(tmp), manifest).map(r => r.key).join("|") === "floor/security.md: 1. Nothing secret|tasks/a.md: Rule one",
    "a project takes the floor's rules and those of the modules its manifest does not leave out");
  const whole = due(manifest, null, tmp), unreadable = due(manifest, "{\"day\": \"today\"}", tmp);
  ok(whole.whole && /no reading/.test(whole.why) && unreadable.whole && /cannot be read/.test(unreadable.why), "with no record, or one in no form it reads, a whole reading is due");
  const recorded = record("2026-11-20", tmp);
  ok(due(manifest, recorded, tmp) === null && said(null) === null, "once recorded, nothing is due");
  write("tasks/a.md", "- **Rule one.** Its text, changed.\n- **Rule three.** New.\n");
  write("tasks/b.md", "- **Rule two.** Left out, and changed.\n");
  const after = due(manifest, recorded, tmp);
  ok(!after.whole && after.day === "2026-11-20" && after.keys.join("|") === "tasks/a.md: Rule one|tasks/a.md: Rule three",
    "after a release, each rule it takes that was added or changed is due, by its key, and none it leaves out", JSON.stringify(after));
  write("tasks/a.md", "- **Rule one.** Its text.\n");
  write("tasks/b.md", "- **Rule two.** Left out.\n");
  ok(due("Modules: all\n", recorded, tmp) === null, "a module taken after the reading asks nothing by itself: its rules stood in the copy then, and are read for what a release changes in them");
  ok(/^2 rules the project takes were added or changed since the reading of 2026-11-20/.test(said(after)) && said(after).includes("`tasks/a.md: Rule three`") && said(after).includes("core-reading.mjs --recorded") && said(whole, "lib/core/").includes("lib/core/roles/auditor.md"),
    "what is due is said with each rule and the command that records the reading, in the copy's own path", said(after));
  fs.rmSync(tmp, { recursive: true, force: true });
}
{
  const here = fs.mkdtempSync(path.join(os.tmpdir(), "core-reading-cli-"));
  ok(/takes no copy/.test(main([], here)), "where no manifest stands, as in the core's own repository, nothing is read");
  fs.writeFileSync(path.join(here, "core-manifest.md"), "Modules: all\n");
  ok(/A whole reading of the project against the core is due/.test(main([], here)), "a project with no record is asked a whole reading");
  ok(main(["--rules"], here).split("\n").includes("floor/security.md: 1. Nothing secret in the repository"), "--rules lists every rule it takes, by its key");
  ok(/recorded/.test(main(["--recorded"], here)) && fs.existsSync(path.join(here, RECORD)) && /No reading of the project against the core is due/.test(main([], here)), "--recorded writes the record, and then nothing is due");
  // (a record, or its folder, reached through a link is never written through: #961's review)
  const outside = path.join(here, "..", `${path.basename(here)}-outside.json`);
  fs.writeFileSync(outside, "kept\n");
  fs.rmSync(path.join(here, RECORD));
  let canLink = true;
  try { fs.symlinkSync(outside, path.join(here, RECORD)); } catch { canLink = false; }
  if (!canLink) console.log("skip the links: this machine lets the test make none");
  else {
  let refused = "";
  try { main(["--recorded"], here); } catch (e) { refused = e.message; }
  ok(mended(`FAIL: ${refused}`) && /reached through a link/.test(refused) && fs.readFileSync(outside, "utf8") === "kept\n", "a record that is a link is refused, with its mend, and what it leads to is left as it was", refused);
  fs.rmSync(path.join(here, "checks"), { recursive: true });
  fs.mkdirSync(path.join(here, "elsewhere"));
  fs.symlinkSync(path.join(here, "elsewhere"), path.join(here, "checks"), "dir");
  refused = "";
  try { main(["--recorded"], here); } catch (e) { refused = e.message; }
  ok(/reached through a link \(checks\)/.test(refused) && !fs.readdirSync(path.join(here, "elsewhere")).length, "and so is one whose folder is a link, writing nothing", refused);
  // (nor read through: the record, or the manifest, a link when what is due is read)
  fs.rmSync(path.join(here, "checks"));
  fs.mkdirSync(path.join(here, "checks"));
  fs.symlinkSync(outside, path.join(here, RECORD));
  refused = "";
  try { main([], here); } catch (e) { refused = e.message; }
  ok(mended(`FAIL: ${refused}`) && /reached through a link/.test(refused), "a record that is a link is not read either, with its mend", refused);
  fs.rmSync(path.join(here, RECORD));
  fs.renameSync(path.join(here, "core-manifest.md"), path.join(here, "manifest-elsewhere.md"));
  fs.symlinkSync(path.join(here, "manifest-elsewhere.md"), path.join(here, "core-manifest.md"));
  refused = "";
  try { main([], here); } catch (e) { refused = e.message; }
  ok(/core-manifest\.md is reached through a link/.test(refused), "nor a manifest that is a link", refused);
  fs.rmSync(path.join(here, "core-manifest.md"));
  fs.renameSync(path.join(here, "manifest-elsewhere.md"), path.join(here, "core-manifest.md"));
  }
  fs.rmSync(outside, { force: true });
  // (a folder where the record stands is neither read nor written, and the failure names no path of the machine's)
  fs.rmSync(path.join(here, "checks"), { recursive: true, force: true });
  fs.mkdirSync(path.join(here, RECORD), { recursive: true });
  let folder = "";
  try { main(["--recorded"], here); } catch (e) { folder = e.message; }
  ok(mended(`FAIL: ${folder}`) && /is not a plain file/.test(folder) && fs.statSync(path.join(here, RECORD)).isDirectory(), "a folder where the record stands is refused, with its mend, and left as it was", folder);
  fs.rmSync(path.join(here, "checks"), { recursive: true });
  fs.writeFileSync(path.join(here, "checks"), "a file where the record's folder goes\n"); // the system's error names the whole path
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/core-reading.mjs", import.meta.url)), "--recorded"], { cwd: here, encoding: "utf8" });
  ok(run.status === 1 && mended(run.stderr.trim()) && /<the project>/.test(run.stderr) && !run.stderr.includes(fs.realpathSync(here)) && !run.stderr.includes(here), "the command's failure line names no path of the machine's", run.stderr);
  fs.rmSync(path.join(here, "checks"));
  // (the command's own exit code and failure line, which only a process shows)
  const wrong = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/core-reading.mjs", import.meta.url)), "--all"], { cwd: here, encoding: "utf8" });
  ok(wrong.status === 1 && mended(wrong.stderr.trim()), "an option it does not know fails, with its mend", wrong.stderr);
  fs.rmSync(here, { recursive: true, force: true });
}
done("what rulesAt reads once and what it reads each time, and what a reading against the core finds due");
