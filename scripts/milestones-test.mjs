// Checks the milestones of the progress file (milestones.mjs, beside this file; tasks/planning.md; #322): the headings
// read, the form's faults, what a pull request that adds, reaches or takes out a milestone is asked, that what stood
// before fails nothing, and that every failure says its mend. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node scripts/milestones-test.mjs
import { MOST } from "./done-when.mjs";
import { mended } from "./mend.mjs";
import { formFaults, milestoneMends, milestonesOf, under } from "./milestones.mjs";
import { planAsked, PLAN_SINCE } from "./pr-description.mjs";

let failed = 0;
const ok = (cond, what, got) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond || got === undefined ? "" : `\n     got: ${JSON.stringify(got).slice(0, 400)}`}`); if (!cond) failed++; };

const file = ["# Progress", "", "## The queue", "", "### Milestone #10: the main thing from start to finish", "",
  "| Issue | Who | Waits on |", "| --- | --- | --- |", "| #11 | builder | |", "| #12 | builder | #11 |", "",
  "### **Milestone** #20: the second", "1. #21, the next", "", "## Beside any line", "- #30", ""].join("\n");

// the headings read
const ms = milestonesOf(file);
ok(ms.length === 2 && ms[0].item === "#10" && ms[0].lines.join() === "#11,#12" && ms[1].item === "#20" && ms[1].lines.join() === "#21",
  "a heading beginning \"Milestone\" names its issue and holds the lines under it, up to the next heading of its level or above", ms);
ok(milestonesOf("## The queue\n- #1\n## Milestones ahead\n- #2\n####Milestone #3\n- #4\n").length === 0, "no other heading is a milestone's, \"Milestones\" and a heading with no blank after its signs among them");
ok(milestonesOf("## Milestone #1\n#### Its part\n- #2\n## Next\n- #3\n")[0].lines.join() === "#2", "a lower heading under it keeps its lines; one of its level ends them");
ok(milestonesOf("## Milestone inbox/first-whole.md\r\n- inbox/a-task.md\r\n")[0].lines.join() === "inbox/a-task.md", "an inbox file stands for an issue, and a file of Windows line ends reads the same");

// the form
ok(formFaults(file).length === 0, "two milestones, each naming its issue, each with its lines: in the form", formFaults(file));
const bad = formFaults("## The queue\n### Milestone: the first whole\n- #1\n### Milestone #20\n## Beside\n- #3\n");
ok(bad.length === 2 && /names no issue/.test(bad[0].what) && /#20 has no line/.test(bad[1].what), "a heading naming no issue and one with no line under it are faults", bad);
ok(bad.every(f => mended(`FAIL ${f.what}`)), "each fault says its mend");
const hostile = formFaults("## Milestone \u0000a\u2028::set-env ##[group]x\n- #1\n").map(f => f.what).join("\n");
ok(!/[\u0000\u2028]/u.test(hostile) && !hostile.includes("##[") && hostile.split("\n").every(l => !l.startsWith("::")), "a heading an outsider wrote is shown with no control character and no command to the runner", hostile);

// a pull request: `states` the items' states, as GitHub would give them
const run = (before, after, body = "## What the owner can try\nNothing.\n", states = {}) => {
  const asked = [];
  const got = milestoneMends({ body, queue: { before, after }, read: item => (asked.push(item), item in states ? states[item] : null), at: "core/" });
  return { ...got, asked };
};
const none = run(file, file.replace("| #12 | builder | #11 |\n", ""));
ok(none.mends.length === 0 && none.asked.length === 0, "a pull request that takes out one line of several asks nothing, and reads nothing", none);
const last = file.replace("1. #21, the next\n", "");
const empty = run(file, last);
ok(empty.mends.length === 1 && /#20 has no line under its heading/.test(empty.mends[0]) && /Fixes #20/.test(empty.mends[0]) && /core\/tasks\/planning\.md/.test(empty.mends[0]),
  "taking out a milestone's last line and leaving its heading fails, saying that it reaches it", empty.mends);
const reached = last.replace("### **Milestone** #20: the second\n", "");
const good = run(file, reached, "Fixes #21 and fixes #20.\n## What the owner can try\nThe second milestone, #20: use it from start to finish.\n## Readings taken\nNone\n");
ok(good.mends.length === 0 && good.asked.length === 0, "the pull request that takes out the last line and the heading, closes the issue and names it under \"What the owner can try\" passes", good.mends);
const unnamed = run(file, reached, "Fixes #20.\n## What the owner can try\nNothing new.\n## Readings taken\n#20 is reached.\n");
ok(unnamed.mends.length === 1 && /does not name it under "What the owner can try"/.test(unnamed.mends[0]), "closing a milestone's issue without naming it under \"What the owner can try\" fails; named elsewhere counts not", unnamed.mends);
ok(run(file, reached, "Fixes #20.\n## What the owner can try\nSee #200.\n").mends.length === 1, "a longer number is no name of the milestone's");
const kept = run(file, file, "Fixes #10.\n## What the owner can try\n#10 is ready.\n");
ok(kept.mends.length === 1 && /leaves its heading/.test(kept.mends[0]), "closing a milestone's issue and leaving its heading fails", kept.mends);
const dropped = run(file, reached, "## What the owner can try\nNothing.\n", { "#20": { state: "open" } });
ok(dropped.mends.length === 1 && /stays open/.test(dropped.mends[0]) && dropped.asked.join() === "#20", "taking out a heading whose issue stays open fails, its issue read once", dropped.mends);
ok(run(file, reached, "", { "#20": { state: "closed" } }).mends.length === 0, "taking out the heading of a milestone whose issue is closed already passes");
const added = file.replace("## Beside any line", "### Milestone #40: the third\n- #41\n\n## Beside any line");
ok(run(file, added, "", { "#40": { state: "open" } }).mends.length === 0, "adding a milestone that names an open issue passes");
const shut = run(file, added, "", { "#40": { state: "closed" } });
ok(shut.mends.length === 1 && /names #40, which is closed/.test(shut.mends[0]), "adding a milestone that names a closed issue fails", shut.mends);
const unread = run(file, added);
ok(unread.mends.length === 0 && /#40 could not be read/.test(unread.notes.join()), "an issue that cannot be read is asked nothing, and that is said", unread);
const limited = run(file, added, "", { "#40": { limited: true } });
ok(limited.mends.length === 1 && /rate limit/.test(limited.mends[0]), "a read the rate limit refused fails, saying to run the check again", limited.mends);
const many = Array.from({ length: MOST + 1 }, (_, i) => `## Milestone #${100 + i}\n- #${200 + i}\n`).join("");
const flood = run(file, `${file}${many}`);
ok(flood.mends.length === 1 && /more than the 12/.test(flood.mends[0]) && flood.asked.length === 0, "a pull request that adds more headings than the check reads fails before any is read", flood);

// what stood before fails nothing
const old = "## Milestone: the first whole\n- #1\n## Milestone #5\n";
ok(run(old, `${old}- #9 a note below\n`.replace("- #9 a note below\n", "")).mends.length === 0, "a fault the base already held fails nothing");
ok(run("", file).mends.length === 0 && run("", "").mends.length === 0, "a file with no milestones, or none at all, asks nothing");
ok(run("## The queue\n- #1\n- #2\n", "## The queue\n- #2\n", "Fixes #1.\n").mends.length === 0, "a pull request that closes an issue no heading names is no milestone's");

// every failure says its mend
const all = [empty, unnamed, kept, dropped, shut, limited, flood].flatMap(r => r.mends);
ok(all.length > 0 && all.every(m => mended(`FAIL ${m}`)), "every failure says its mend", all.filter(m => !mended(`FAIL ${m}`)));

// the text under a heading
ok(under("# A\nx\n## What the owner can try (now)\ny #3\n## Next\nz\n", "What the owner can try") === "y #3" && under("no heading", "What the owner can try") === null, "the text under a heading runs to the next");

// asked only of a pull request opened since the copy on its base held it
const holds = "export const PLAN_SINCE = \"x\";";
ok(planAsked("2026-11-18T00:00:00Z", holds) && planAsked(PLAN_SINCE, holds), "asked of a pull request opened on or after the day, its base's copy holding it");
ok(!planAsked("2026-11-16T23:59:59Z", holds) && !planAsked("2026-11-18T00:00:00Z", "an older copy") && !planAsked("2026-11-18T00:00:00Z", null), "not of one opened before, nor one whose base's copy lacked it or could not be read");

// a long file of signs and spaces is read in no time
const slow = Date.now();
milestonesOf(`${"#".repeat(300000)} x\n${"## Milestone ".repeat(100000)}\n${" ".repeat(300000)}#1\n`.repeat(3));
under(`${"#".repeat(300000)} x\n${" ".repeat(300000)}\n`, "What the owner can try");
ok(Date.now() - slow < 2000, "a long progress file or description is read in no time");

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
