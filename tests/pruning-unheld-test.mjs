// Tests of the rules with no holder in the pruning's list (pruning-list.mjs; AGENTS.md, "Rules are pruned by their numbers";
// #545, with #887's forms beside each proposal): they lead the list, each with its proposal and the form a check could hold.
// Split from tests/pruning-test.mjs (#895). Node's own modules only.
//
//   node tests/pruning-unheld-test.mjs
import fs from "node:fs";
import path from "node:path";
import { list, readUnheld } from "../scripts/pruning-list.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { R, still, loud, floor, passed, own, numbers, named, p, cases } from "./pruning-fixtures.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const rec = (...ps) => ({ prunings: ps });
const steps = { ".github/workflows/tests.yml": [{ name: "A and B", run: "node scripts/a.mjs && node scripts/b.mjs" }, { name: "Its test", run: "node scripts/a-test.mjs" }], ".github/workflows/own.yml": [{ name: "C", run: "node scripts/c.mjs" }, { name: "D", run: "node scripts/d2.mjs" }] };

// ---- the rules with no holder lead the list (#545) ----
const bare = R("tasks/e.md", "Bare"), early = R("roles/shared/e.md", "At start"), floorBare = R("floor/security.md", "3. Bare"), unproposed = R("tasks/e.md", "Unproposed");
const proposals = { [bare.key]: { mark: "goes", why: "no breach recorded", noForm: "its breach is in what a session says" }, [early.key]: { mark: "check", by: "#9", why: "a script reads it" },
  [floorBare.key]: { mark: "goes", why: "it costs much", form: "a script reads the file" }, [loud.key]: { mark: "move", why: "held now" }, "tasks/gone.md: Gone": { mark: "case", why: "gone" } };
const led = list({ all: [still, bare, early, floorBare, unproposed, loud], named, numbers, record: rec(...p), cases, steps, starts: new Set([still.key, early.key]), joined: () => 40,
  none: [bare.key, early.key, floorBare.key, unproposed.key], proposals });
const at = k => led.findIndex(l => l.startsWith(`- ${k}:`));
ok(/^- No holder: 4 rules \(`scripts\/holders\.mjs`\), worst first, each with its proposal \(`reports\/unheld\.json`\)\./u.test(led[0])
  && at(early.key) === 1 && at(bare.key) > at(early.key) && at(bare.key) < led.findIndex(l => l.startsWith("- Read:")),
  "the rules with no holder lead the list, ahead of what the pruning read, one read at a role's start first", led.slice(0, 7).join("\n"));
ok(led[at(early.key)] === `- ${early.key}: no holder, read at a role's start. Its proposal: check (#9), a script reads it.` && led[at(bare.key)] === `- ${bare.key}: no holder, read on need. Its proposal: goes, no breach recorded. No form a check could hold: its breach is in what a session says.`,
  "each says where it is read and its proposal, a check with the issue that builds it", `${led[at(early.key)]}\n${led[at(bare.key)]}`);
ok(/^- floor\/security\.md: 3\. Bare: no holder, read on need\. Its proposal: goes, it costs much\. A form a check could hold: a script reads the file\. It guards against rare and severe harm, so it is proposed a holder, a check or a staged case, and nothing else\.$/u.test(led[at(floorBare.key)])
  && /No proposal yet: the session that takes the pruning gives it one in `reports\/unheld\.json`/u.test(led[at(unproposed.key)]),
  "a floor rule proposed to go is said to need a holder instead, and a rule with no proposal is said to need one");
// ---- beside each proposal, a form a check could hold, or why none (#887) ----
const forms = list({ all: [bare, early, still, floorBare, unproposed, loud], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key, early.key, still.key, floorBare.key, unproposed.key, loud.key],
  proposals: { [bare.key]: { mark: "move", why: "read rarely" }, [early.key]: { mark: "check", why: "a script reads it" }, [still.key]: { mark: "check", why: "reworded", form: "the file holds the line" }, [floorBare.key]: { mark: "case", why: "a session's act", noForm: "only what a session does shows it" },
    [unproposed.key]: { mark: "describes", why: "binds no one" }, [loud.key]: { mark: "goes", why: "unused", form: "a script reads the line" } } });
const formOf = k => forms.find(l => l.startsWith(`- ${k}:`)) ?? "";
ok(formOf(bare.key).endsWith(" No form proposed yet: the session that takes the pruning gives a form of the rule a check could hold (`form`), or why none exists (`noForm`).")
  && formOf(floorBare.key).endsWith(" No form a check could hold: only what a session does shows it.") && formOf(loud.key).endsWith(" A form a check could hold: a script reads the line.")
  && !/form/iu.test(formOf(early.key)) && !/form/iu.test(formOf(unproposed.key)) && formOf(still.key).endsWith(" A form a check could hold: the file holds the line.")
  && forms.filter(l => / no holder, /u.test(l) && !/check \(|check, |describes, /u.test(l)).every(l => /(A form a check could hold|No form a check could hold|No form proposed yet|a form of the rule a check could hold)/u.test(l)),
  "each rule with no holder carries a form a check could hold or why none exists, or is said to have neither yet; a check, which holds it as worded, and a rule that describes need neither, a check's rewording shown where given", forms.join("\n"));
const tool = R("tools/x.md", "Its own"), floorNone = R("floor/topics/y.md", "Unproposed");
const tooled = list({ all: [bare, tool, floorNone], named, numbers, record: rec(), cases, steps, starts: new Set(), toolStarts: new Set([tool.key]), joined: () => 40, none: [bare.key, tool.key, floorNone.key], proposals });
ok(tooled[1].startsWith(`- ${tool.key}: no holder, read at its tool's start.`) && /^- floor\/topics\/y\.md: Unproposed: no holder, read on need\. No proposal yet: .*a check or staged case that could hold it, since it guards against rare and severe harm, and a form of the rule a check could hold \(`form`\), or why none exists \(`noForm`\)\.$/u.test(tooled.find(l => l.startsWith(`- ${floorNone.key}:`)) ?? ""),
  "a rule of a tool's part, read at its tool's start, comes first, and a floor rule with no proposal is offered only a holder", tooled.join("\n"));
const forged = list({ all: [bare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key],
  proposals: { [bare.key]: { mark: "goes", by: "#1\n- tasks/x.md: Forged", why: "one\n- tasks/y.md: Forged too", form: "two\n- tasks/z.md: Forged" } }, wrong: "`reports/unheld.json` cannot be read (bad). Mend: write it as JSON" });
ok(forged.length === 4 && forged[1].startsWith("- `reports/unheld.json` cannot be read (bad). Mend:") && forged[2] === `- ${bare.key}: no holder, read on need. Its proposal: goes (#1 - tasks/x.md: Forged), one - tasks/y.md: Forged too. A form a check could hold: two - tasks/z.md: Forged.`,
  "a value of the file holding a line break stays on its rule's line, and a file that cannot be read is said with its mend", forged.join("\n"));
const scratch = scratchDir("unheld-");
const at2 = t => { fs.mkdirSync(path.join(scratch, "reports"), { recursive: true }); fs.writeFileSync(path.join(scratch, "reports", "unheld.json"), t); return readUnheld(scratch); };
const none0 = readUnheld(scratch), broken = at2("{"), listed = at2('{"proposals": []}'), good = at2('{"proposals": {"k": {"mark": "goes"}}}');
fs.rmSync(scratch, { recursive: true, force: true });
ok(!none0.wrong && !Object.keys(none0.proposals).length && /Mend: \S+ \S/u.test(broken.wrong) && /Mend: \S+ \S/u.test(listed.wrong) && !Object.keys(listed.proposals).length && !good.wrong && good.proposals.k.mark === "goes",
  "no file reads as no proposals, a file that is no JSON or whose proposals are a list is said with its mend, and a good one is read", JSON.stringify({ broken, listed }));
const lone = list({ all: [bare, floorBare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key, floorBare.key],
  proposals: { [bare.key]: { mark: "check", why: "a script could read it" }, [floorBare.key]: { mark: "move", why: "read rarely" } } });
ok(lone.some(l => l === `- ${bare.key}: no holder, read on need. Its proposal: check, no issue filed yet: the session files one where its upkeep pays, which joins the queue as any check for a rule that stands does, a script could read it.`)
  && lone.some(l => l.startsWith(`- ${floorBare.key}:`) && l.endsWith("so it is proposed a holder, a check or a staged case, and nothing else.")) && !lone.slice(1).some(l => l.includes("the owner's")),
  "a check with no issue is the session's to file, never the owner's, and a floor rule proposed a move is said to need a holder", lone.join("\n"));
ok(led.includes(`- Proposed for a rule that now has a holder or no longer stands, to take out of \`reports/unheld.json\`: ${loud.key}; tasks/gone.md: Gone.`) && !led.some(l => l.startsWith(`- ${loud.key}: no holder`)),
  "a proposal whose rule now has a holder, or is gone, is named to be taken out");
ok(list({ all: [bare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key], proposals: {} }).at(-1).startsWith("- No pruning is recorded yet")
  && list({ all: [bare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key], proposals: {} })[0].startsWith("- No holder: 1 rule (")
  && list({ all: [still], named, numbers, record: rec(p[2]), cases, steps, starts: new Set(), joined: () => 40 })[0].startsWith("- Read:"),
  "with no pruning recorded the rules with no holder are still listed, and with none the list opens as before");

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
