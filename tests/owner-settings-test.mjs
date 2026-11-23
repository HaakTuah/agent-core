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
import { SETTINGS, checklist, forReport, idsAt, readHost, statesOf } from "../scripts/owner-settings.mjs";
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
  execFileSync("git", ["init", "-q"], { cwd: root, env }); // (its own files are those git lists: own-files.mjs)
  const review = text => fs.writeFileSync(path.join(root, ".github", "workflows", "security-review.yml"), text);

  const call = w => `on:\n  pull_request:\n    types: [opened, reopened, synchronize, ready_for_review]\n  issue_comment:\n    types: [created, edited]\njobs:\n  queue:\n    permissions:\n      contents: read\n      pull-requests: read\n      issues: read\n    uses: someone/agent-core/.github/workflows/queue-only.yml@${"a".repeat(40)}\n  security-review:\n    needs: queue\n    if: \${{ !cancelled() }}\n    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n    uses: someone/agent-core/.github/workflows/security-review.yml@${"a".repeat(40)} # the pin\n${w}`;

  // every setting given, in a public repository
  review(call(""));
  const rules = checks => [{ type: "deletion" }, { type: "non_fast_forward" }, { type: "pull_request" }, { type: "required_status_checks", parameters: { required_status_checks: checks.map(context => ({ context })) } }];
  const all = {
    repo: { body: { private: false, default_branch: "main", security_and_analysis: { secret_scanning: { status: "enabled" }, secret_scanning_push_protection: { status: "enabled" } } } },
    rules: { body: rules(["core / core", "security-review", "tests"]) },
    secrets: { body: { secrets: [{ name: "PERSONAL_TERMS" }] } },
    actions: { body: { sha_pinning_required: true } },
  };
  let s = statesOf(all, root);
  ok(IDS.filter(id => id !== "reviewer-app" && id !== "ruleset").every(id => s[id].given === true), "a project with every setting given reads each as given", JSON.stringify(s));
  ok(s["reviewer-app"].given === null && /not read/.test(s["reviewer-app"].said), "the reviewer's app, which no session's sign-in may list, is said not read, never guessed");
  ok(/its value is not read/.test(s["personal-terms"].said), "the secret is read by its name alone");
  ok(s.ruleset.given === null && /the core's part is given/.test(s.ruleset.said) && /beside the core's are `tests`; compare them/.test(s.ruleset.said), "the ruleset is never ticked on a guess at the project's own CI: the core's part said given, the checks beside it named", s.ruleset.said);
  s = statesOf({ ...all, rules: { body: rules(["core / core", "security-review"]) } }, root);
  ok(s.ruleset.given === null && /no check is required beside the core's/.test(s.ruleset.said), "a ruleset with the core's checks alone is not ticked: the project's own CI is said not read", s.ruleset.said);
  const many = { ...all, secrets: { body: { total_count: 31, secrets: [{ name: "OTHER" }] } } };
  ok(statesOf({ ...many, terms: { body: { name: "PERSONAL_TERMS" } } }, root)["personal-terms"].given === true, "past the page read, the secret asked by name and there: given");
  ok(statesOf({ ...many, terms: { why: "GitHub answered 404, which it gives an account that may not read it" } }, root)["personal-terms"].given === false, "past the page read, the secret asked by name and not there: not given");
  ok(statesOf(many, root)["personal-terms"].given === null, "past the page read and not asked by name: not read, never not given");

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
  review(`jobs:\n  security-review:\n    uses: someone/agent-core/.github/workflows/security-review.yml@${"a".repeat(40)}\n`);
  const privately = { ...all, repo: { body: { ...all.repo.body, private: true } } };
  s = statesOf(privately, root);
  ok(s["security-review-required"].given === null && /with: private: true/.test(s["security-review-required"].said), "a private repository whose call does not run the check: not asked for", s["security-review-required"].said);
  for (const [w, said] of [["    with:\n      private: true\n", "`private: true`"], ["    with:\n      advisory: false\n", "`advisory: false`, which posts the status"],
    ["    with: { private: true }\n", "`private: true` in a flow mapping"], ["    with:\n      private: true # runs in a private repository\n", "`private: true` with a comment"],
    ["    with:\n      advisory: false  # enforce review\n", "`advisory: false` with a comment"]]) {
    review(call(w));
    ok(statesOf(privately, root)["security-review-required"].given === true, `a private repository whose call is given ${said}: read from the ruleset`);
    review(call(w).replace("  issue_comment:\n    types: [created, edited]\n", "  issue_comment:\n").replace("    needs: queue\n    if: ${{ !cancelled() }}\n    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n", "").replace("jobs:", "permissions: write-all\njobs:"));
    ok(statesOf(privately, root)["security-review-required"].given === true, `a private repository whose call is given ${said}: read from the ruleset`);
  }
  const perms = "    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n", ons = /on:\n  pull_request:\n.*\n  issue_comment:\n.*\n/;
  for (const [text, said] of [[call("    with:\n      private: ${{ vars.PRIVATE }}\n"), "an input read only at its run"], ["jobs: [\n", "no YAML"],
    ["jobs:\n  other:\n    uses: x/y/.github/workflows/z.yml@b\n    with:\n      private: true\n", "no call of the core's security review"],
    [call("    with:\n      private: true\n").replace(/^  (queue|security-review):\n    /gm, "  - "), "jobs as a list, which GitHub refuses"],
    [call("    with:\n      private: true\n").replace(perms, ""), "no permissions given, left to the repository's default"],
    [call("    with:\n      private: true\n").replace(perms, "").replace("jobs:", "permissions: {}\njobs:"), "a workflow that grants nothing"],
    [call("    with:\n      private: true\n").replace(/  queue:\n[\s\S]*?(?=  security-review:)/, ""), "a job needed that is not there"],
    [`# private: true\n${call("    with:\n      private: false\n")}`, "only a comment that says it, not the call"]]) {
    review(text);
    const st = statesOf(privately, root)["security-review-required"];
    ok(said.startsWith("only") ? st.given === null && /^does not apply/.test(st.said) : st.given === null && /^not read: /.test(st.said), `a private repository whose call holds ${said}: ${said.startsWith("only") ? "not asked for" : "said not read, never not for it"}`, st.said);
  }
  // each break of a call that would post, in a private repository giving private: true and in a public one
  for (const [change, said] of [[t => t.replace("if: ${{ !cancelled() }}", "if: false"), "a condition on its call other than the kit's"],
    [t => t.replace(ons, "on: [push]\n"), "no pull request among its triggers"],
    [t => t.replace("types: [opened, reopened, synchronize, ready_for_review]", "types: [closed]"), "a pull request's types the kit's do not hold"],
    [t => t.replace("types: [opened, reopened, synchronize, ready_for_review]", "types: [opened, reopened, synchronize]"), "a pull request's types without a draft marked ready"],
    [t => t.replace(ons, "on: [pull_request, issue_comment]\n"), "GitHub's own types of a pull request, which leave out a draft marked ready"],
    [t => t.replace("    types:", "    branches: [release]\n    types:"), "a filter of branches"],
    [t => t.replace("    types:", "    paths: ['docs/**']\n    types:"), "a filter of paths"],
    [t => t.replace(/  issue_comment:\n.*\n/, ""), "no comment among its triggers, through which alone a pull request of Dependabot's or a fork's gets the status"],
    [t => t.replace("types: [created, edited]", "types: [deleted]"), "a comment's types the kit's do not hold"],
    [t => t.replace("      statuses: write\n", "      statuses: read\n"), "a job given no right to write statuses"],
    [t => t.replace(perms, "    permissions:\n      statuses: write\n"), "a call granted statuses alone, less than the review asks"],
    [t => t.replace("      contents: read\n      pull-requests: read\n      issues: read\n", "      contents: none\n"), "a queue's call granted less than it asks"],
    [t => t.replace("    needs: queue\n", "    needs: [queue, build]\n"), "a job needed that is not there"],
    [t => t.replace("queue-only.yml", "other.yml"), "a call of another workflow, whose asks are not read"],
    [t => t.replace("jobs:", "concurrency:\n  group: x\n  cancel-in-progress: true\njobs:"), "a concurrency, by which a later run may cancel the one that posts"],
    [t => t.replace("    needs: queue\n", "    needs: queue\n    concurrency: { group: x, cancel-in-progress: true }\n"), "a concurrency on its call"],
    [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    with:\n      advisroy: false\n"), "an input its workflow does not define"],
    [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    with:\n      private: 'yes'\n"), "an input not of its type"],
    [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    secrets: inherit\n"), "a secret passed"], [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    runs-on: x\n"), "a call with a runner"],
    [t => t.replace("  queue:\n", "  queue:\n    needs: security-review\n"), "jobs that need each other"], [t => t.replace("needs: queue", "needs: [queue, security-review]"), "a job that needs itself"],
    [t => t.replace("jobs:\n", "jobs:\n  build:\n    runs-on: x\n    steps: [{ run: echo }]\n"), "a job not a call, which may wait on a runner or an approval"],
    [t => t.replace("jobs:", "bogus: 1\njobs:"), "a key at its top not the kit's"], [t => t.replace("  queue:\n", "  1q:\n").replace("needs: queue", "needs: 1q"), "a job named as GitHub refuses"],
    [t => t.replace("    if: ${{ !cancelled() }}\n", ""), "a job it needs and no condition, so skipped where that job fails"]]) {
    for (const [w, answers, where] of [["    with:\n      private: true\n", privately, "private"], ["", none, "public"]]) {
      const broken = change(call(w));
      review(broken);
      const st = statesOf(answers, root)["security-review-required"];
      ok(broken !== call(w) && st.given === null && /^not read: /.test(st.said), `a ${where} repository whose call holds ${said}: said not read, never asked for`, st.said);
    }
  }
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
  ok(asked.join(" | ") === "repos/someone/a game | repos/someone/a game/rules/branches/main | repos/someone/a game/actions/secrets?per_page=100 | repos/someone/a game/actions/permissions", "it asks GitHub four reads, the branch's rules by the default branch GitHub names", asked.join(" | "));
  asked.length = 0;
  const host = readHost("someone/a-game", route => { asked.push(route); return route === "repos/someone/a-game" ? all.repo : /secrets\?/.test(route) ? many.secrets : /secrets\//.test(route) ? { body: { name: "PERSONAL_TERMS" } } : { body: [] }; });
  ok(asked.length === 5 && asked[3] === "repos/someone/a-game/actions/secrets/PERSONAL_TERMS" && host.terms.body.name === "PERSONAL_TERMS", "where the list runs past its page, the secret is asked by name, a fifth read", asked.join(" | "));
  review(call(""));
  const list = checklist({ repo: "someone/a-game", states: statesOf(none, root), fresh: ["personal-terms"], script: "core/scripts/owner-settings.mjs" });
  ok(/^The settings only the owner gives, for someone\/a-game \(`core\/scripts\/owner-settings.mjs`[^\n]*: 0 given, 6 not, 1 not read/.test(list), "the checklist opens with its counts", list.split("\n")[0]);
  ok(/one sitting: the owner starts a session in person, which applies each setting the owner approves[\s\S]*reads each back/.test(list) && /Nothing waits on them/.test(list), "it says how the sitting goes, and that nothing waits on it");
  ok(list.split("\n").filter(l => l.startsWith("- [ ] ")).length === SETTINGS.length && list.includes("Set at: https://github.com/someone/a-game/settings/secrets/actions"), "one unticked line a setting, each with its link");
  ok((list.match(/\(new since the copy before\)/g) ?? []).length === 1 && /PERSONAL_TERMS`[^\n]*\(new since the copy before\)/.test(list), "a setting new since the copy before is marked so");
  const ticked = checklist({ repo: null, states: statesOf(all, root), script: "x" });
  ok(ticked.split("\n").filter(l => l.startsWith("- [x] ")).length === SETTINGS.length - 2 && !/Set at:/.test(ticked) && /on no github\.com/.test(ticked), "every setting given ticks all but the unread; with no repository on github.com, no link is made, and that is said");

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
  r = run("--report");
  ok(r.status === 0 && r.out.trim().split("\n").length === 2 && /did not answer that it is private/.test(r.out) && !/^- \[/m.test(r.out), "for a sync's report, with no answer of GitHub's, only the counts and where the rest is read", r.out);
  for (const [said, repo, whole] of [["private", { body: { private: true } }, true], ["public", { body: { private: false } }, false], ["not answered", { why: "GitHub answered 502" }, false],
    ["answered with no word on it", { body: {} }, false], ["answered \"true\"", { body: { private: "true" } }, false]]) {
    const report = forReport(list, { repo }, "s.mjs");
    ok(whole ? report === list : report.split("\n").length === 2 && report.startsWith(list.split("\n")[0]) && !/^- \[/m.test(report),
      `a sync's report of a repository ${said} carries ${whole ? "the whole checklist" : "the counts alone"}`);
  }
  r = run("--since", "abc");
  ok(r.status === 1 && /^FAIL: [^\n]*Mend: /.test(r.out), "a wrong call fails, saying its mend", r.out);
  ok(g(root, "status", "--porcelain") === status, "it writes nothing in the project");
} finally { fs.rmSync(at, { recursive: true, force: true }); }

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
