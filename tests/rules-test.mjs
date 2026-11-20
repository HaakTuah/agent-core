// Tests rulesAt (scripts/rules.mjs; #812): the rules of a commit are read from git once for each root, commit and
// `agents`, since the staged cases set from one commit read it once for each case (staged.mjs, fingerprints), where
// a name that can move (HEAD, a branch) is read each time, and what a caller does with the rules it was given changes
// none that is asked after. A repository of three commits of one rule file; git and Node's own modules.
//
//   node tests/rules-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rulesAt } from "../scripts/rules.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const repo = path.join(scratchDir("rules-test-"), "repo");
fs.mkdirSync(repo);
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(repo, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = text => { fs.mkdirSync(path.join(repo, "tasks"), { recursive: true }); fs.writeFileSync(path.join(repo, "tasks", "a.md"), text); git("add", "-A"); git("commit", "-q", "-m", "x"); return git("rev-parse", "HEAD"); };
git("init", "-q", "-b", "main");
const leads = rs => rs.map(r => r.lead).join();

const one = commit("- **Rule one.** Its text.\n"), two = commit("- **Rule one.** Its text.\n- **Rule two.** More.\n");
ok(leads(rulesAt(repo, one)) === "Rule one" && leads(rulesAt(repo, two)) === "Rule one,Rule two" && leads(rulesAt(repo, one)) === "Rule one",
  "the rules of two commits of one repository are each its own, in either order they are asked");
const given = rulesAt(repo, two);
given.pop(); given[0].text = "changed by a caller";
ok(leads(rulesAt(repo, two)) === "Rule one,Rule two" && rulesAt(repo, two)[0].text === "- **Rule one.** Its text.", "what a caller does with the rules it was given changes none that is asked after");
ok(leads(rulesAt(repo, two, { agents: true })) === "Rule one,Rule two", "a commit asked with its AGENTS.md too, none there, gives the same rules");

// (a commit read once is read again from no repository: the repository is taken away, and what was read still answers)
fs.renameSync(path.join(repo, ".git"), path.join(repo, ".git-away"));
ok(leads(rulesAt(repo, one)) === "Rule one" && leads(rulesAt(repo, two, { agents: true })) === "Rule one,Rule two", "a commit read before is not read again");
let named = null;
try { rulesAt(repo, "HEAD"); } catch (e) { named = e; }
let unread = null;
try { rulesAt(repo, "0".repeat(40)); } catch (e) { unread = e; }
ok(named && unread, "a name that can move, and a commit not read before, are read from git, which the taken-away repository cannot answer");
fs.renameSync(path.join(repo, ".git-away"), path.join(repo, ".git"));
const three = commit("- **Rule three.** Last.\n");
ok(leads(rulesAt(repo, "HEAD")) === "Rule three" && leads(rulesAt(repo, three)) === "Rule three" && leads(rulesAt(repo, "HEAD~1")) === "Rule one,Rule two",
  "a name that moves (HEAD) is read again each time, and gives the commit it names now");
// (a name that holds a whole commit's id among other characters is still a name: a branch moved after it was read)
for (const name of [`moves-${one}`, `${one}-moves`]) {
  git("branch", "-f", name, one);
  const before = leads(rulesAt(repo, name));
  git("branch", "-f", name, three);
  ok(before === "Rule one" && leads(rulesAt(repo, name)) === "Rule three", `a branch named ${name.replace(one, "<its id>")}, moved after it was read, is read again`);
}
done("what rulesAt reads once and what it reads each time");
