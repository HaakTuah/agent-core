// Tests of the daily reading of the Dependabot alerts (scripts/alerts.mjs; #1142), on a stand-in for GitHub: an alert
// with an open pull request of Dependabot's for its package is no task, one without becomes a bug issue, worded as an
// update, once; an answer refusing the read reads nothing and says so. The alerts are made up, plainly so: no package
// or advisory here is real. Node's own modules.
//
//   node tests/alerts-test.mjs
import { DAY, LABELS, bodyOf, reading, tasksOf, titleOf } from "../scripts/alerts.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const at = "2030-01-10T12:00:00Z", old = new Date(Date.parse(at) - 2 * DAY).toISOString(), fresh = new Date(Date.parse(at) - 3600 * 1000).toISOString();
const alert = (number, name, created_at = old) => ({ number, created_at, html_url: `https://github.com/stand-in/repo/security/dependabot/${number}`, package: { ecosystem: "pip", name }, manifest: "package-lock.json", ghsa: "GHSA-aaaa-bbbb-cccc", fixed: "9.9.9" });
const pull = (title, ref, login = "dependabot[bot]") => ({ title, head: { ref }, body: "", user: { login }, state: "open" });

// A stand-in for gh: the alerts (or a refusal), the open pull requests, the issues, and each issue it is asked to make.
function stand({ alerts = [], pulls = [], issues = [], refuse = null }) {
  const made = [];
  const gh = (...a) => {
    if (a[0] === "--method") { made.push(Object.fromEntries(a.filter((_, i) => a[i - 1] === "-f").map(f => f.split(/=(.*)/s).slice(0, 2)).filter(([k]) => k !== "labels[]")).title); return "{}"; }
    const route = a.find(x => x.startsWith("repos/"));
    if (route.includes("/dependabot/alerts")) { if (refuse) throw new Error(`gh: ${refuse}`); return alerts.map(x => JSON.stringify(x)).join("\n"); }
    if (route.includes("/pulls")) return JSON.stringify(route.includes("page=1&") || route.endsWith("page=1") ? pulls : []);
    if (route.includes("/issues")) return JSON.stringify(route.endsWith("page=1") ? issues : []);
    throw new Error(`no stand-in for ${route}`);
  };
  return { gh, made };
}
const run = (s, dry = false) => { const said = []; const got = reading({ repo: "stand-in/repo", at, dry, gh: s.gh, say: l => said.push(l) }); return { ...got, said: said.join("\n") }; };

// ---- the three cases the issue names ----
{
  const s = stand({ alerts: [alert(7, "made-up-widget")], pulls: [pull("Bump made-up-widget from 1.0.0 to 9.9.9", "dependabot/npm_and_yarn/made-up-widget-9.9.9")] });
  const got = run(s);
  ok(got.filed.length === 0 && s.made.length === 0, "an alert with an open pull request of Dependabot's for its package is no task");
}
{
  const s = stand({ alerts: [alert(8, "made-up-gadget")] });
  const got = run(s);
  ok(got.filed.length === 1 && s.made[0] === titleOf(alert(8, "made-up-gadget")), "an alert open more than a day with no such pull request is filed as one issue", JSON.stringify(s.made));
  ok(/Dependabot alert 8\)$/.test(s.made[0] ?? "") && /fixes a published advisory/.test(s.made[0] ?? ""), "its title names the package and the alert, and that it fixes a published advisory");
}
{
  const s = stand({ alerts: [alert(9, "made-up-gizmo")], refuse: "HTTP 403: Resource not accessible by integration" });
  const got = run(s);
  ok(got.unread && got.filed.length === 0 && s.made.length === 0 && /read nothing/.test(got.said) && /may not read them/.test(got.said), "an answer refusing the read reads nothing, files nothing and says so", got.said);
  const none = run(stand({ refuse: "HTTP 404: Not Found" }));
  ok(none.unread && /read nothing/.test(none.said), "a 404 reads nothing and says so too");
}

// ---- what else it holds ----
ok(tasksOf([alert(10, "made-up-thing", fresh)], [], at).length === 0, "an alert open less than a day is left for Dependabot's own pull request");
ok(tasksOf([alert(11, "made-up-thing")], [pull("Bump made-up-thing from 1 to 2", "x", "someone")], at).length === 1, "a pull request of another account's for the package does not count as Dependabot's");
ok(tasksOf([alert(12, "made-up-thing")], [pull("Bump made-up-thing-extra from 1 to 2", "dependabot/npm_and_yarn/made-up-thing-extra-2")], at).length === 1, "a pull request for a package whose name only starts with the alert's does not count");
ok(tasksOf([alert(13, "made-up-thing")], [pull("Bump the npm group across 1 directory with 3 updates", "dependabot/npm_and_yarn/npm-1a2b3c")].map(p => ({ ...p, body: "Bumps [made-up-thing](https://example.invalid) from 1 to 2." })), at).length === 0, "a grouped pull request whose description names the package counts");
{
  const s = stand({ alerts: [alert(14, "made-up-part")], issues: [{ title: titleOf(alert(14, "made-up-part")), state: "closed" }] });
  ok(run(s).filed.length === 0 && s.made.length === 0, "an alert whose issue stands, even closed, is never filed again");
}
{
  const s = stand({ alerts: [alert(15, "made-up-piece")] });
  ok(run(s, true).filed.length === 1 && s.made.length === 0, "--dry says what it would file and writes nothing");
}
{
  const b = bodyOf({ ...alert(16, "made-`odd`\u0007name"), ghsa: "not an id", html_url: "javascript:alert(1)" });
  ok(!/`odd`/.test(b) && !/\u0007/.test(b) && /named in the alert/.test(b) && /in the Security tab/.test(b) && !/javascript:/.test(b), "GitHub's values are made plain, and an id or link out of its form is left out");
  ok(/^Found while: /m.test(bodyOf(alert(17, "made-up-bit"))) && /needs-owner/.test(bodyOf(alert(17, "made-up-bit"))) && /never in an issue/.test(bodyOf(alert(17, "made-up-bit"))), "its body says where it was found, the dismissal to ask the owner for, and the private report");
  ok(LABELS.includes("bug") && LABELS.includes("queued"), "it is filed as a bug, which needs no line in the queue");
}

console.log(`${count} assertions on the reading of the Dependabot alerts`);
if (failed) { console.error(`${failed} failed`); process.exitCode = 1; }
