// The step of setup/sync-notes/270-the-size-marks-total-counts-the-project-s-own.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { READ_MOST } from "../own-files.mjs";
import { Unread, marksConfig } from "../check-configs.mjs";
import { COST, shown } from "../step-checks.mjs";

export default { lead: "14 November 2026, the size marks' total counts the project's own files", cost: COST.line,
  // (the reading-size check passes and says so in a note, which no run of it turns red: this step reads that note,
  // from the project's own copy of the check, and gives its number)
  check: p => {
    const marks = marksConfig(p);
    const script = path.join(p.root, "core", "scripts", "reading-size.mjs");
    if (!fs.existsSync(script) || p.read(marks) === null) throw new Unread(`no copy of the reading-size check, or no ${marks}, to read`);
    // (the check reads each file its marks name: one the steps' reader would not read is never handed to it; #423)
    let named = {};
    try { named = JSON.parse(p.read(marks))?.read ?? {}; } catch { /* (its own run says what of the marks it cannot read) */ }
    const unsafe = Object.keys(named && typeof named === "object" ? named : {}).filter(f => !p.safe(f));
    if (unsafe.length) throw new Unread(`${marks} names ${unsafe.map(f => `\`${shown(f)}\``).join(", ")}, which is no regular file of the project's own of at most ${READ_MOST} bytes`);
    const r = spawnSync(process.execPath, [script, marks], { cwd: p.root, encoding: "utf8", env: { ...process.env, SIZES_BASE: "" } });
    // (a run that never reached its end, where its notes and its verdict are given, read nothing: reported as not
    // read, never as done. It ends passing with its "ok" line, or failing with its verdicts alone, every line of its
    // errors one, and none of the refusals it gives before it reads: no config named, one that is no JSON or of the
    // wrong shape, or no base to compare with)
    const out = `${r.stdout}`, lines = `${r.stderr}`.split(/\r?\n/).filter(Boolean);
    const early = /^FAIL: (no config was named|.* could not be read as JSON|.* is not in the form the check reads|\S+ is not a commit here)/;
    const ended = !r.error && (r.status === 0 ? /^ok {3}read by every session/m.test(out)
      : r.status === 1 && lines.length > 0 && lines.every(l => l.startsWith("FAIL: ") && !early.test(l)));
    if (!ended) throw new Unread(`the reading-size check did not run to its end on ${marks}`);
    const to = /set it to (\d+) \(core\/setup\/sync-notes\.md, 14 November 2026\)/.exec(out)?.[1];
    return to ? `The "total" in \`${marks}\` is set to ${to}, the number the reading-size check's note gives, so the project keeps the room it had and the core's copy is held by the core's own cap.` : null;
  } };
