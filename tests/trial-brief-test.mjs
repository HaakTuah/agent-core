// Tests of the brief of a release's trial (scripts/trial-brief.mjs; #1413, point 1): the brief read for each step the
// trial's rules ask (read-only and the blocks on the clone, the run before the sync and the run after it, the pure-sync
// reading, the drafts in the owner's own projects, the record), each command one the script it names takes, the projects
// found through a stand-in for gh, and no brief where gh gives no answer. Every name is invented. Node's own modules.
//
//   node tests/trial-brief-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brief, briefFor, run } from "../scripts/trial-brief.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { ownCount } from "../scripts/release-trial.mjs";
import { projects } from "../scripts/state-report.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OWN = ["example-owner/game-one", "example-owner/game-two"], OTHER = "someone-else/their-app";
const text = brief(SHA, OWN, [OTHER]);
const step = n => text.split("\n").reduce((acc, line) => {
  const m = /^(\d+)\. /.exec(line);
  if (m) acc.at = Number(m[1]);
  if (acc.at === n) acc.lines.push(line);
  return acc;
}, { at: -1, lines: [] }).lines.join("\n");

// the projects: each found one of the owner's own with a draft, the one given of another owner's with none, named in
// no public text
ok(OWN.every(n => text.includes(`\`${n}\`, the owner's own: tried read-only, its sync opened as a draft pull request`)), "each of the owner's own projects is tried read-only and gets a draft", text.slice(0, 900));
ok(text.includes(`\`${OTHER}\`, of another owner, which allows it: tried read-only, nothing at all written to it`) && /Name it in no public text/.test(text) && /given in private/.test(text), "the project of another owner is tried read-only, written to not at all, and named in no public text");
ok(/no project of the owner's takes the core, and none of another owner's was given\. Step 8 records a trial of none/.test(brief(SHA, [], [])), "with no project found or given, the brief says to record a trial of none");

// read-only, and the blocks on the clone
const one = step(1);
ok(/keeping its remote `origin`/.test(one) && /remote set-url --push origin no-push:\/\/the-trial/.test(one) && /remote get-url --push origin` prints `no-push:\/\/the-trial`/.test(one), "the clone keeps its remote, its push address is blocked, and the block is checked by reading it", one);
ok(/Never check it by trying a push/.test(one) && !/(try|attempt)[a-z]* (a|to) push(?! and waiting)/i.test(text.replace("Never check it by trying a push and waiting for a refusal", "")), "no step asks for a push expected to be refused, which on a project the account can write goes through (release 6's fault)");
ok(/Nothing is written to the project's repository but the draft step 6 opens/.test(one), "nothing is written to a project but the draft in the owner's own");
ok(/floor rule 18/.test(one) && /machine of its own, holding no clone, verdict or reading of another project's/.test(one) && /on a machine of its own after the owner's own projects/.test(text) && /never in the one of the owner's projects/.test(text) && /has a scratch folder of its own, set up the same way, on its own machine/.test(step(0)) && /from its own machine, read as data alone \(floor rule 4\), and nothing of the owner's projects goes to that machine/.test(step(8)) && /`gh auth status` fails/.test(one) && /git credential fill/.test(one) && /none in its files, and none its network adds/.test(one) && /Where that is not shown[^.]*run nothing of it/.test(one) && /only through `<scratch>\/core\/scripts\/check\.mjs`/.test(one), "another owner's code runs only where no sign-in answers, and only through the release's check.mjs");
ok(/outside every repository/.test(step(0)) && new RegExp(`checkout --detach ${SHA}`).test(step(0)), "the scratch folder lies outside every repository, and the core is cloned at the commit tried");

// the toolchain, the run before the sync and the run after it, in that order
const order = ["toolchain.mjs .", "-before.json", "sync.mjs " + SHA, "pure-sync.mjs --trial " + SHA, "trial-draft.mjs <owner>/<name> <its number> " + SHA, "-after.json", "release.mjs --trial " + SHA].map(s => text.indexOf(s));
ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), "the toolchain, the run before, the sync, its reading, the draft, the run after and the record come in that order", JSON.stringify(order));
ok(/--own --own-repository --verdicts <scratch>\/<name>-before\.json/.test(step(3)) && /no check\.mjs, or one without `--verdicts`, and for every project of another owner, run `node <scratch>\/core\/scripts\/check\.mjs`/.test(step(3)), "the run before is the copy's check.mjs, or the release's where the copy has none or the project is another owner's");
ok(/git stash pop/.test(step(7)) && /never pushed/.test(step(7)) && /--own --own-repository --verdicts <scratch>\/<name>-after\.json/.test(step(7)), "the run after holds the steps' writes, committed and never pushed");

// the pure-sync reading, and the drafts
ok(/pure-sync\.mjs --trial [0-9a-f]{40} > <scratch>\/<name>-sync\.txt/.test(step(5)) && /stops no cut; a trial recorded without it for a project does/.test(step(5)), "the sync's reading is taken against the commit tried, to a file outside every repository");
const six = step(6);
ok(/agents-stop/.test(six) && /draft=true/.test(six) && /pinned to 0123456/.test(six) && /takes it once the release is cut/.test(six) && /never the steps' writes, never marked ready, never merged before the cut/.test(six), "the draft is opened only where the stop switch does not stand, pinned, the pure sync alone, never ready or merged before the cut", six);
ok(new RegExp(`trial-draft\\.mjs <owner>/<name> none ${SHA}`).test(six), "another owner's project, or one behind its stop switch, takes the reading of none");
const later = brief("fedcba9876543210fedcba9876543210fedcba98", OWN);
const branches = t => [...t.matchAll(/(?:switch -c |refs\/heads\/|head=(?:<owner>:)?)([\w-]+)/g)].map(m => m[1]);
ok(branches(text).join() === branches(later).join() && branches(text).includes("core-trial") && /--force HEAD:refs\/heads\/core-trial`/.test(six) && /open no second draft/.test(six) && /ls-remote origin refs\/heads\/core-trial` prints nothing, or the branch of an open draft/.test(six) && /a branch of the project's own, push nothing/.test(six) && /fresh scratch folder/.test(six), "a trial moved to a newer commit pushes to the same branch, so the same draft moves forward, from a fresh scratch folder, and no second draft is opened (#1334)", branches(text).join());
ok(/switch -c core-trial-after/.test(step(7)) && /stays the pure sync/.test(step(7)) && !/core-trial-after/.test(six), "the steps' writes are committed on a branch of their own, never the draft's, so a retry pushes the pure sync alone");
ok(/another owner, run `node <scratch>\/core\/scripts\/check\.mjs` with the same options, save `--own-repository`, instead, as in step 3, never the copy's/.test(step(7)), "the run after runs another owner's project through the release's check.mjs, as the run before does");
ok(/`--own-repository` says the clone is of the owner's own project, so that its NuGet check runs its restores: leave it out where the copy's check\.mjs does not know it, and for every project of another owner/.test(step(3)), "only the owner's own projects are run as the repository's own, so their NuGet check restores");

// the record
const eight = step(8);
ok(/changes `reports\/release-trial\.json` alone/.test(eight) && /--sync <scratch>\/<name>-sync\.txt --draft <scratch>\/<name>-draft\.txt/.test(eight) && /naming no project/.test(eight) && new RegExp(`release\\.mjs --trial ${SHA}\` alone`).test(eight), "the record is written by release.mjs --trial with each project's four files, in a pull request of its own that names no project");

// each script the brief runs is the core's, and takes the options the brief gives it
const takes = { "check.mjs": ["--base", "--own", "--verdicts"], "pure-sync.mjs": ["--trial"], "trial-draft.mjs": ["none", "--gate"], "release.mjs": ["--trial", "--sync", "--draft"], "sync.mjs": [], "toolchain.mjs": [] };
const named = [...new Set([...text.matchAll(/scripts\/([\w-]+\.mjs)/g)].map(m => m[1]))].filter(f => f !== "trial-brief.mjs");
ok(named.length === Object.keys(takes).length && named.every(f => Object.hasOwn(takes, f)), "the brief runs the trial's scripts alone", named.join(", "));
const missing = Object.entries(takes).flatMap(([f, opts]) => { const src = fs.readFileSync(path.join(ROOT, "scripts", f), "utf8"); return opts.filter(o => !src.includes(`"${o}"`) && !src.includes(`${o} `)).map(o => `${f} ${o}`); });
ok(!missing.length, "each option the brief gives a script is one that script reads", missing.join(", "));

// the projects found through gh: the account's own that pin a copy, not the core, not another's
{
  const manifest = Buffer.from(`# Core manifest\n\nCore: ${CORE} at ${SHA}, copied whole under core/ (never edited here).\n`).toString("base64");
  const own = { login: "example-owner" }, theirs = { login: "friend" };
  // (forks as a list gives them, with no parent: one of the owner's own repository, one of another's)
  const repos = [{ full_name: "example-owner/game-one", private: true, fork: false, owner: own }, { full_name: "example-owner/notes", private: false, fork: false, owner: own }, { full_name: "friend/shared", private: true, fork: false, owner: theirs }, { full_name: CORE, private: false, fork: false, owner: own }, { full_name: "example-owner/game-copy", private: true, fork: true, owner: own }, { full_name: "example-owner/shared", private: true, fork: true, owner: own }, { full_name: "example-owner/no-field", private: true, owner: own }, { full_name: "example-owner/half", private: true, fork: true, owner: own }];
  const whole = { "repos/example-owner/game-copy": { full_name: "example-owner/game-copy", fork: true, owner: own, parent: { owner: own }, source: { owner: own } }, "repos/example-owner/shared": { full_name: "example-owner/shared", fork: true, owner: own, parent: { owner: theirs }, source: { owner: theirs } },
    "repos/example-owner/no-field": { full_name: "example-owner/no-field", fork: false, owner: own }, "repos/example-owner/half": { full_name: "example-owner/half", fork: true, owner: own, parent: { owner: own }, source: { owner: theirs } } };
  const gh = (...a) => {
    if (a[0] === "user") return "example-owner\n";
    if (a[0].startsWith("user/repos")) return JSON.stringify(a[0].includes("page=1") ? repos : []);
    if (Object.hasOwn(whole, a[0])) return JSON.stringify(whole[a[0]]);
    const m = /^repos\/(.+)\/contents\/core-manifest\.md$/.exec(a[0]);
    if (m && m[1] !== "example-owner/notes") return JSON.stringify({ content: manifest });
    throw new Error("gh: Not Found (HTTP 404)");
  };
  const got = briefFor(SHA, [OTHER], gh);
  ok(got.text?.includes("`example-owner/game-one`, the owner's own") && !/example-owner\/notes|friend\/shared/.test(got.text) && !got.text.includes(`\`${CORE}\`, the owner's`), "of what gh lists, only the account's own repositories whose manifest pins a copy are the owner's projects", got.why ?? "");
  ok(got.text?.includes("`example-owner/game-copy`, the owner's own") && !got.text.includes("example-owner/shared") && !got.text.includes("example-owner/half"), "a fork is the owner's own only where its parent and source are the account's too: a fork of another's repository, under the account's name, is not, nor one whose source is another's", got.why ?? "");
  ok(got.text?.includes("`example-owner/no-field`, the owner's own"), "a list's answer that does not say whether it is a fork is read from the repository's own answer", got.why ?? "");
  // (the state report reads them the same way, and the trial's record counts the owner's own from what it prints)
  const printed = [], log = console.log;
  console.log = l => printed.push(l);
  try { projects([], gh); } finally { console.log = log; }
  const rows = printed.join("\n");
  ok(ownCount(rows) === 3 && (rows.match(/^- a project of another owner: /gm) ?? []).length === 3, "--projects names as the owner's own the same three, and the forks of another's beside another owner's project as another owner's", rows);
  const unread = briefFor(SHA, [], (...a) => { if (a[0] === "repos/example-owner/shared") throw new Error("gh: HTTP 502 Bad Gateway"); return gh(...a); });
  ok(!unread.text && /Mend: run it again where gh answers/.test(unread.why ?? ""), "where a fork's own answer cannot be read, no brief, never the fork read as the owner's own or not", unread.why ?? "");
  const down = briefFor(SHA, [], () => { throw new Error("gh: connection refused"); });
  ok(!down.text && /nothing read is not none found\. Mend: run it again where gh answers/.test(down.why ?? ""), "where gh gives no answer, no brief, and the mend says why");
  const empty = briefFor(SHA, [], (...a) => a[0] === "user" ? "example-owner\n" : a[0].startsWith("user/repos") ? "[]" : gh(...a));
  ok(!empty.text && /Mend: run it again where gh answers/.test(empty.why ?? ""), "where gh lists no repository at all, no brief, never one that records a trial of none");
  ok(/Mend: give --other only for a project of another owner/.test(briefFor(SHA, ["Example-Owner/game-one"], gh).why ?? ""), "an --other that names one of the owner's own projects is refused");
  const asked = [];
  const named = briefFor(SHA, [], (...a) => { asked.push(a[0]); if (a[0].startsWith("user/repos")) throw new Error("gh: listing refused (HTTP 403)"); if (a[0] === "repos/example-owner/game-two") return JSON.stringify({ full_name: "example-owner/game-two", private: false, fork: false, owner: own, permissions: { push: true } }); if (a[0] === "repos/example-owner/shared") return JSON.stringify({ ...whole[a[0]], private: true, permissions: { push: true } }); return gh(...a); }, ["example-owner/game-two", "example-owner/shared"]);
  ok(named.text?.includes("`example-owner/game-two`, the owner's own") && !named.text.includes("game-one") && !named.text.includes("example-owner/shared") && !asked.some(r => r.startsWith("user/repos")), "with --repo, the repositories named are read in place of the account's list", named.why ?? asked.join(" "));
}

// the command line: each refusal says its mend, and gives no brief
const never = () => { throw new Error("gh is not asked for a command line it refuses"); };
for (const [args, what] of [[["abc"], "a commit that is no full SHA"], [[SHA, "--other"], "an --other with no name"], [[SHA, "--other", "no-slash"], "an --other that is no repository"], [[SHA, "--repo", "--other", "a/b"], "a --repo with no name"], [[SHA, "--loose"], "an option it does not take"]]) {
  const r = run(args, never);
  ok(!r.text && mended(`FAIL: ${r.why}`), `${what} is refused, its failure saying the mend, and no brief given`, r.why ?? r.text);
}

console.log(`${count} assertions on the trial's brief${failed ? `, ${failed} failed` : ""}`);
if (failed) process.exit(1);
