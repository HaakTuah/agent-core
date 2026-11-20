import fs from "node:fs";
const rows = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map(l => JSON.parse(l));
const cat = {};
for (const r of rows) {
  const a = r.args.join(" "), c = r.cmd;
  const k = /git/i.test(c) ? (/clone|checkout/.test(a) ? "git clone/checkout" : "git other") : /bash/i.test(c) ? "bash step" : /check\.mjs/.test(a) ? "check.mjs (nested total)" : "other: " + (c + " " + a).slice(0, 50);
  (cat[k] ??= [0, 0]); cat[k][0]++; cat[k][1] += r.dt;
}
for (const [k, v] of Object.entries(cat).sort((x, y) => y[1][1] - x[1][1]).slice(0, 14)) console.log(String(v[0]).padStart(5), String(Math.round(v[1] / 1000)).padStart(6) + " s", k);
const g = rows.filter(r => /git/i.test(r.cmd) && /clone|checkout/.test(r.args.join(" ")));
const byKind = {};
for (const r of g) { const k = r.args.slice(0, 3).join(" ").replace(/[0-9a-f]{40}/g, "<sha>").replace(/\S*(project\.git|agent-core)\S*/, "<url>").slice(0, 60); (byKind[k] ??= [0, 0]); byKind[k][0]++; byKind[k][1] += r.dt; }
for (const [k, v] of Object.entries(byKind).sort((x, y) => y[1][1] - x[1][1]).slice(0, 8)) console.log(String(v[0]).padStart(5), String(Math.round(v[1] / 1000)).padStart(6) + " s", k);
