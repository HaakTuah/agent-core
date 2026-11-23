// Tests of the settings only a project's owner gives (owner-settings.mjs; #1085): each setting read as given, not
// given and not read from what GitHub answers, on a project with each given and with none; the checklist with its
// links, its counts and the settings new since a copy marked; the list at an older commit of the core read from a bare
// repository; and the script itself, which writes nothing, asks GitHub nothing where its origin is on no github.com,
// prints one line where no setting is new, and fails only a wrong call, saying its mend. Git and Node's own modules.
//
//   node tests/owner-settings-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SETTINGS, checklist, idsAt, readHost, statesOf } from "../scripts/owner-settings.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const SCRIPT = fileURLToPath(new URL("../scripts/owner-settings.mjs", import.meta.url));
const IDS = SETTINGS.map(s => s.id);

ok(IDS.length === new Set(IDS).size && SETTINGS.every(s => s.id && s.setting && s.protects && /^settings\//.test(s.page)), "each setting has its own id, what it is, what it protects and the page it is set on");

const at = scratchDir("owner-settings-");
try {
  const root = path.join(at, "project"), env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(at, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  const review = text => fs.writeFileSync(path.join(root, ".github", "workflows", "security-review.yml"), text);

  // every setting given, in a public repository
  review("jobs:\n  security-review:\n    uses: x\n");
  const rules = checks => [{ type: "deletion" }, { type: "non_fast_forward" }, { type: "pull_request" }, { type: "required_status_checks", parameters: { required_status_checks: checks.map(context => ({ context })) } }];
  const all = {
    repo: { body: { private: false, default_branch: "main", security_and_analysis: { secret_scanning: { status: "enabled" }, secret_scanning_push_protection: { status: "enabled" } } } },
    rules: { body: rules(["core / core", "security-review"]) },
    secrets: { body: { secrets: [{ name: "PERSONAL_TERMS" }] } },
    actions: { body: { sha_pinning_required: true } },
  };
  let s = statesOf(all, root);
  ok(IDS.filter(id => id !== "reviewer-app").every(id => s[id].given === true), "a project with every setting given reads each as given", JSON.stringify(s));
  ok(s["reviewer-app"].given === null && /not read/.test(s["reviewer-app"].said), "the reviewer's app, which no session's sign-in may list, is said not read, never guessed");
  ok(/its value is not read/.test(s["personal-terms"].said), "the secret is read by its name alone");

  // none given
  const none = {
    repo: { body: { private: false, default_branch: "main", security_and_analysis: { secret_scanning: { status: "disabled" }, secret_scanning_push_protection: { status: "disabled" } } } },
    rules: { body: [] },
    secrets: { body: { secrets: [{ name: "OTHER" }] } },
    actions: { body: { sha_pinning_required: false } },
  };
  s = statesOf(none, root);
  ok(IDS.filter(id => id !== "reviewer-app").every(id => s[id].given === false), "a project with no setting given reads each as not given", JSON.stringify(s));
  ok(/no ruleset applies to `main`/.test(s.ruleset.said) && /deletions restricted, force pushes blocked, a pull request required, the status check `core \/ core` required/.test(s.ruleset.said), "no ruleset: said, with all it lacks");
  s = statesOf({ ...none, rules: { body: rules(["security-review"]).slice(1) } }, root);
  ok(s.ruleset.given === false && /it lacks deletions restricted, the status check `core \/ core` required$/.test(s.ruleset.said) && !/no ruleset applies/.test(s.ruleset.said), "a ruleset that lacks some: each it lacks named", s.ruleset.said);

  // what does not apply, and what cannot be read
  fs.rmSync(path.join(root, ".github", "workflows", "security-review.yml"));
  s = statesOf(all, root);
  ok(s["security-review-required"].given === null && /does not apply here: the project has no/.test(s["security-review-required"].said), "no security-review workflow: the status is not asked for, since one never posted would hold every pull request");
  review("jobs:\n  security-review:\n    uses: x\n");
  const privately = { ...all, repo: { body: { ...all.repo.body, private: true } } };
  s = statesOf(privately, root);
  ok(s["security-review-required"].given === null && /with: private: true/.test(s["security-review-required"].said), "a private repository whose call does not run the check: not asked for", s["security-review-required"].said);
  review("jobs:\n  security-review:\n    uses: x\n    with:\n      private: true\n");
  ok(statesOf(privately, root)["security-review-required"].given === true, "a private repository whose call is given `private: true`: read from the ruleset");
  fs.rmSync(path.join(root, ".github", "workflows", "security-review.yml"));
  if (process.platform !== "win32") { // (a link needs a right of its own on Windows)
    fs.symlinkSync(path.join(at, "elsewhere.yml"), path.join(root, ".github", "workflows", "security-review.yml"));
    ok(statesOf(all, root)["security-review-required"].given === null, "a workflow that is a link is not followed: read as not there");
    fs.rmSync(path.join(root, ".github", "workflows", "security-review.yml"));
  }
  const refused = { why: "GitHub answered 403, which it gives an account that may not read it" };
  s = statesOf({ repo: { body: { private: false, default_branch: "main" } }, rules: refused, secrets: refused, actions: { body: {} } }, root);
  ok(["secret-scanning", "push-protection", "ruleset", "personal-terms", "sha-pinning"].every(id => s[id].given === null && /^not read: /.test(s[id].said)) && /answered 403/.test(s.ruleset.said), "a refused or empty answer: each said not read, with why", JSON.stringify(s));
  s = statesOf({ repo: { why: "gh gave no answer here" }, rules: null, secrets: null, actions: null }, root);
  ok(IDS.every(id => s[id].given === null), "no answer for the repository: nothing read as given or not");

  // the questions asked of GitHub, and the checklist
  const asked = [];
  readHost("someone/a game", route => { asked.push(route); return route === "repos/someone/a game" ? all.repo : { body: [] }; });
  ok(asked.join(" | ") === "repos/someone/a game | repos/someone/a game/rules/branches/main | repos/someone/a game/actions/secrets | repos/someone/a game/actions/permissions", "it asks GitHub four reads, the branch's rules by the default branch GitHub names", asked.join(" | "));
  review("jobs:\n  security-review:\n    uses: x\n");
  const list = checklist({ repo: "someone/a-game", states: statesOf(none, root), fresh: ["personal-terms"], script: "core/scripts/owner-settings.mjs" });
  ok(/^The settings only the owner gives, for someone\/a-game \(`core\/scripts\/owner-settings.mjs`[^\n]*: 0 given, 6 not, 1 not read/.test(list), "the checklist opens with its counts", list.split("\n")[0]);
  ok(/one sitting: the owner starts a session in person, which applies each setting the owner approves[\s\S]*reads each back/.test(list) && /Nothing waits on them/.test(list), "it says how the sitting goes, and that nothing waits on it");
  ok(list.split("\n").filter(l => l.startsWith("- [ ] ")).length === SETTINGS.length && list.includes("Set at: https://github.com/someone/a-game/settings/secrets/actions"), "one unticked line a setting, each with its link");
  ok((list.match(/\(new since the copy before\)/g) ?? []).length === 1 && /PERSONAL_TERMS`[^\n]*\(new since the copy before\)/.test(list), "a setting new since the copy before is marked so");
  const ticked = checklist({ repo: null, states: statesOf(all, root), script: "x" });
  ok(ticked.split("\n").filter(l => l.startsWith("- [x] ")).length === SETTINGS.length - 1 && !/Set at:/.test(ticked) && /on no github\.com/.test(ticked), "every setting given ticks all but the unread; with no repository on github.com, no link is made, and that is said");

  // the list at an older commit of the core, from a bare repository
  const core = path.join(at, "core"), bare = path.join(at, "bare");
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, env, encoding: "utf8" }).trim();
  fs.mkdirSync(path.join(core, "scripts"), { recursive: true });
  g(core, "init", "-q"); g(core, "-c", "user.name=a", "-c", "user.email=a@example.invalid", "commit", "-q", "--allow-empty", "-m", "before the list");
  const before = g(core, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(core, "scripts", "owner-settings.json"), JSON.stringify(SETTINGS));
  g(core, "add", "-A"); g(core, "-c", "user.name=a", "-c", "user.email=a@example.invalid", "commit", "-q", "-m", "the list");
  const withList = g(core, "rev-parse", "HEAD");
  g(at, "clone", "-q", "--bare", core, bare);
  ok(idsAt(withList, bare).join() === IDS.join() && idsAt(before, bare).length === 0, "the list at a commit is read from the bare repository; one from before it holds none");

  // the script itself: run from a project with no origin on github.com, which asks GitHub nothing
  g(root, "init", "-q");
  const status = g(root, "status", "--porcelain");
  const run = (...a) => { const r = spawnSync(process.execPath, [SCRIPT, ...a], { cwd: root, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
  let r = run();
  ok(r.status === 0 && /^The settings only the owner gives \(`/.test(r.out) && /on no github\.com/.test(r.out), "the script prints the checklist and exits 0, with no origin on github.com", r.out);
  r = run("--since", withList, "--fetched", bare);
  ok(r.status === 0 && /^No setting only the owner gives is new since [0-9a-f]{7}: the sitting is not asked again/.test(r.out), "at a sync where no setting is new: one line, the sitting not asked again", r.out);
  r = run("--since", before, "--fetched", bare);
  ok(r.status === 0 && (r.out.match(/\(new since the copy before\)/g) ?? []).length === SETTINGS.length, "at a sync from a copy before the list: every setting asked, each marked new", r.out);
  r = run("--since", "abc");
  ok(r.status === 1 && /^FAIL: [^\n]*Mend: /.test(r.out), "a wrong call fails, saying its mend", r.out);
  ok(g(root, "status", "--porcelain") === status, "it writes nothing in the project");
} finally { fs.rmSync(at, { recursive: true, force: true }); }

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
