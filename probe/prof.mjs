import cp, { syncBuiltinESMExports } from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports as sync } from "node:module";
const log = process.env.PROF_LOG;
const note = (t, cmd, args, opts) => fs.appendFileSync(log, JSON.stringify({ dt: Math.round(performance.now() - t), cmd: String(cmd).slice(-30), args: (Array.isArray(args) ? args : []).slice(0, 5).map(x => String(x).slice(-70)), pid: process.pid }) + "\n");
for (const name of ["spawnSync", "execFileSync"]) {
  const orig = cp[name];
  cp[name] = function (cmd, args, opts) { const t = performance.now(); try { return orig.apply(this, arguments); } finally { note(t, cmd, args, opts); } };
}
sync();
