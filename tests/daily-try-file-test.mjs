// Tests of the daily try's counts (scripts/daily-try-file.mjs; #1413, point 5): each runner's line read from its own
// log alone and only where it gives that runner's own number, the runners' counts summed with a runner that said
// nothing counted as not tried, and what is filed counts and conclusions alone, one bug at a time, the sign-in asked of
// the owner while it is not given. On a stand-in for GitHub; Node's own modules only. The runners' own tries:
// tests/daily-try-test.mjs.
//
//   node tests/daily-try-file-test.mjs
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { COUNTS } from "../scripts/release-trial.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { LINE, OWNER, SIGNIN, TITLE, bugText, file, formed, gather, legLines } from "../scripts/daily-try-file.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const SHA = "2".repeat(40);

// what is filed: counts and conclusions alone, one bug at a time, the sign-in asked of the owner while it is not given
{
  const t = { commit: SHA, day: "2026-11-27", signedIn: false, found: 3, private: 1, tried: 2, atPin: 0, untried: 0, syncFailed: 1, afterUnread: 0, held: 1, ...Object.fromEntries(["passedBoth", "fixedAfter", "failedBoth", "failedAfter", "failedAfterAlone", "stoppedAfter", "stoppedNeither", "ranAfterAlone", "ranBeforeAlone", "failedBeforeAlone", "unrunAfter", "unrunAfterRan", "unreadAfter", "unreadBefore", "unreadNeither"].map(k => [k, 0])), failedAfter: 1, name: `${OWNER}/game-one` };
  ok(formed(t) && !formed({ ...t, held: "1" }) && !formed({ ...t, commit: "main" }) && !formed({ ...t, tried: 9 }), "only counts in the form the run writes are filed");
  const issues = (open = [], shut = []) => route => {
    if (/\/comments/u.test(route)) return JSON.stringify(open.flatMap(i => i.comments ?? []));
    if (/issues\?state=open/u.test(route)) return JSON.stringify(open);
    if (/issues\?state=closed/u.test(route)) return JSON.stringify(shut);
    throw new Error("gh: Not Found (HTTP 404)");
  };
  const wrote = [], write = (m, r, b) => wrote.push({ m, r, b });
  file(t, { gh: issues(), write, say: () => {} });
  const bug = wrote.find(w => w.b.title === TITLE), signin = wrote.find(w => w.b.title === SIGNIN);
  ok(bug && bug.m === "POST" && bug.b.labels.join() === "bug,queued,by:look" && bug.b.assignees.join() === OWNER && bug.b.body.includes(SHA) && /1 project whose checks the trial's reading holds \(1 passed before the sync and failed after/u.test(bug.b.body) && /1 project whose sync to the commit failed/u.test(bug.b.body), "a held try files one bug, labelled and assigned, saying the commit and the counts", bug?.b.body);
  ok(!wrote.some(w => JSON.stringify(w.b).includes("game-one")) && /--local/u.test(bug.b.body) && /Mend:/u.test(bug.b.body), "it names no project, even one smuggled into the counts, and says how a session finds which", bugText(t));
  ok(signin && signin.b.labels.join() === "needs-owner,by:look" && /PROJECTS_READ/u.test(signin.b.body), "without the sign-in, one issue asks it of the owner, labelled needs-owner", signin?.b.labels);
  ok(/today it found 3 projects\./u.test(signin.b.body) && /matters only where a private project of the owner's takes the core/u.test(signin.b.body) && /Where none does, the owner may close this issue, and the try does not file it again\./u.test(signin.b.body), "the ask says the sign-in matters only where a private project takes the core, the count found, and that the owner may close it otherwise", signin?.b.body);
  wrote.length = 0;
  file({ ...t, held: 0, syncFailed: 0, tried: 3, failedAfter: 0 }, { gh: issues([], [{ number: 9, title: SIGNIN, body: "" }]), write, say: () => {} });
  ok(wrote.length === 0, "a sign-in's issue the owner closed is never filed again", JSON.stringify(wrote));
  wrote.length = 0;
  const standing = [{ number: 7, title: TITLE, body: "of an earlier commit", comments: [] }, { number: 8, title: SIGNIN, body: "" }];
  file(t, { gh: issues(standing), write, say: () => {} });
  ok(wrote.length === 1 && wrote[0].r.endsWith("issues/7/comments"), "an open bug gets a comment for a new commit held, never a second issue, and the sign-in's issue is not filed twice", JSON.stringify(wrote.map(w => w.r)));
  wrote.length = 0;
  standing[0].comments = [{ body: `held ${SHA}` }];
  file(t, { gh: issues(standing), write, say: () => {} });
  ok(wrote.length === 0, "a commit the bug already holds is not noted again", JSON.stringify(wrote));
  file({ ...t, signedIn: true, held: 0, syncFailed: 0, tried: 3, failedAfter: 0 }, { gh: issues(standing), write, say: () => {} });
  ok(wrote.map(w => `${w.m} ${w.r}`).join() === `POST repos/${CORE}/issues/8/comments,PATCH repos/${CORE}/issues/8`, "a try that held nothing files nothing, and once the sign-in is given its issue is closed", JSON.stringify(wrote));
  wrote.length = 0;
  let threw = false;
  try { file({ ...t, commit: "not one" }, { gh: issues(), write, say: () => {} }); } catch { threw = true; }
  ok(threw && wrote.length === 0, "counts in no form write nothing");
}

// the hostile cases of the runners' lines and the counts (SECURITY.md, rule 5)
{
  const base = { commit: SHA, day: "2026-11-27", signedIn: true, found: 0, private: 0, tried: 0, atPin: 0, untried: 0, syncFailed: 0, afterUnread: 0, held: 0, ...Object.fromEntries(["passedBoth", "fixedAfter", "failedBoth", "failedAfter", "failedAfterAlone", "stoppedAfter", "stoppedNeither", "ranAfterAlone", "ranBeforeAlone", "failedBeforeAlone", "unrunAfter", "unrunAfterRan", "unreadAfter", "unreadBefore", "unreadNeither"].map(k => [k, 0])) };
  const refused = [null, undefined, "", [], "counts", 5, {}, { ...base, commit: `<b>${SHA}</b>` }, { ...base, commit: "../../../etc/passwd" }, { ...base, day: "<img src=x>" },
    { ...base, found: -1 }, { ...base, found: 2 ** 60 }, { ...base, held: 0.5 }, { ...base, signedIn: "true" }, { ...base, private: 1 }];
  ok(formed(base) && refused.every(t => !formed(t)), "counts that are nothing at all, of the wrong type, markup, a file path or a number out of range are in no form", JSON.stringify(refused.filter(t => formed(t))));
  const big = { leg: 1, commit: SHA, came: "tried", ...Object.fromEntries(Object.keys(base).filter(k => !["commit", "day", "signedIn", "found", "private", "tried", "atPin", "untried", "syncFailed", "afterUnread", "held"].includes(k)).map(k => [k, 0])) };
  const huge = [{ ...big, passedBoth: 2 ** 52 }, { ...big, passedBoth: 10001 }, { ...big, came: "held\n" }, { ...big, came: "toString" }, { ...big, why: "a line of the project's own output" }, { ...big, why: "toString" }, { ...big, why: 5 }, { ...big, came: "held", why: "syncRefused" }];
  const g = gather([...huge.map(l => ({ leg: 1, text: JSON.stringify(l) })), { leg: 2, text: `${JSON.stringify({ ...big, leg: 2 })}${" ".repeat(5000)}` }], { sha: SHA, day: "2026-11-27", signedIn: true, found: 2, privates: 0 });
  ok(g.untried === 2 && g.passedBoth === 0 && formed(g), "a runner's line with a count past 10,000, of no class, a reason out of the fixed list or past 4 KB is not read, so no runner can stop the filing for the rest", JSON.stringify(g).slice(0, 200));
  const logs = { 11: `x\n${LINE}{"forged":1}\nmore\n${LINE}${JSON.stringify(big)}\nafter`, 12: `${LINE}{}`.padEnd((16 << 20) + 10, "x"), 13: "nothing said", 14: `${LINE}${JSON.stringify(big)}` };
  const jobs = [{ id: 11, name: "try 1" }, { id: 12, name: "try 2" }, { id: 13, name: "try 3" }, { id: 14, name: "try-file" }, { id: "15", name: "try 4" }];
  const ghLogs = route => {
    if (/\/runs\/7\/attempts\/2\/jobs\?per_page=100&page=1$/u.test(route)) return JSON.stringify({ jobs });
    const m = /\/actions\/jobs\/(\d+)\/logs$/u.exec(route);
    if (m && logs[m[1]]) return logs[m[1]];
    throw new Error("gh: Not Found (HTTP 404)");
  };
  const ll = legLines(7, 2, { gh: ghLogs, repo: CORE });
  ok(ll.length === 1 && ll[0].leg === 1 && ll[0].text === JSON.stringify(big), "of each runner's log the last counts line alone is read; a log past 16 MB, a job not of the try's runners and one with no number are not", JSON.stringify(ll).slice(0, 200));
  let refusedJobs = null;
  try { legLines(8, 1, { gh: ghLogs, repo: CORE }); } catch (e) { refusedJobs = e; }
  ok(refusedJobs instanceof Error, "GitHub refusing the list of jobs throws, never read as runners that said nothing");
  let refusedLog = null;
  const flaky = (route, ...a) => {
    if (/\/jobs\?/u.test(route)) return JSON.stringify({ jobs: [{ id: 11, name: "try 1" }] });
    if (a.length) throw new Error("gh: Server Error (HTTP 502)");
    return logs[11];
  };
  try { legLines(7, 2, { gh: flaky, repo: CORE }); } catch (e) { refusedLog = e; }
  ok(/HTTP 502/u.test(refusedLog?.message), "GitHub refusing a log throws; only gh's refusal of the flag itself is asked again without it (#1549)", String(refusedLog));
}

// --file's reading through the gh on the path (#1549), by the script's own call (ghApi): a job's log holds the runner's
// colour codes, which a gh from 2.97.0 on refuses to print without its flag and an older one takes no such flag; each
// still gives the runner's counts. The stand-in answers as each gh does, its words those of gh 2.97.0 and 2.89.0.
{
  const dir = scratchDir("daily-try-file-"), bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  const counts = { leg: 1, commit: SHA, came: "held", ...Object.fromEntries(COUNTS.map(k => [k, 0])), failedAfter: 1 };
  fs.writeFileSync(path.join(dir, "log"), `2026-11-27T06:00:00.0000000Z \u001b[36;1mnode scripts/daily-try.mjs --run\u001b[0m\n2026-11-27T06:00:01.0000000Z ${LINE}${JSON.stringify(counts)}\r\n2026-11-27T06:00:02.0000000Z \u001b[0;32mdone\u001b[0m\n`);
  fs.writeFileSync(path.join(dir, "jobs"), JSON.stringify({ jobs: [{ id: 11, name: "try 1" }, { id: 12, name: "try-file" }] }));
  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh
case " $* " in *" --allow-escape-sequences "*) flag=1;; *) flag=;; esac
if [ -n "$flag" ] && [ "$GH_KIND" = old ]; then echo 'unknown flag: --allow-escape-sequences' >&2; exit 1; fi
case "$2" in
  */attempts/1/jobs*) cat "${path.join(dir, "jobs")}";;
  */jobs/11/logs) if [ -z "$flag" ] && [ "$GH_KIND" = new ]; then echo 'the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway' >&2; exit 1; fi; cat "${path.join(dir, "log")}";;
  *issues*) echo '[]';;
  *) echo 'gh: Not Found (HTTP 404)' >&2; exit 1;;
esac
`, { mode: 0o755 });
  // (the stand-in for gh is a shell script, which Windows cannot run)
  if (process.platform === "win32") console.log("skip --file's reading through the gh on the path: its stand-in for gh is a shell script");
  else {
    const was = { PATH: process.env.PATH, GH_KIND: process.env.GH_KIND };
    process.env.PATH = `${bin}${path.delimiter}${was.PATH}`;
    try {
      for (const kind of ["new", "old"]) {
        process.env.GH_KIND = kind;
        const wrote = [];
        let err = "";
        try { file(gather(legLines(7, 1), { sha: SHA, day: "2026-11-27", signedIn: true, found: 1, privates: 0 }), { write: (m, r, b) => wrote.push(b), say: () => {} }); } catch (e) { err = e.message; }
        const body = wrote.find(b => b.title === TITLE)?.body ?? "";
        ok(/1 project whose checks the trial's reading holds \(1 passed before the sync and failed after/u.test(body) && !body.includes("\u001b"), `--file reads the counts of a log that holds escape sequences, with a gh ${kind === "new" ? "from 2.97.0 on, given its flag" : "older than 2.97.0, which takes no such flag"}`, err.slice(0, 300) || body.slice(0, 300));
      }
    } finally {
      for (const [k, v] of Object.entries(was)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

console.log(`${count - failed} of ${count} assertions on the daily try's counts`);
if (failed) process.exitCode = 1;
