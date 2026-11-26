// Checks the duplicate-key check (scripts/json-keys.mjs; #1367): a key that stands twice in one object of a JSON file fails,
// at the lines of the two, with a mend the way scripts/mend.mjs words it; the same key in two objects, in an array's objects,
// as a value, or a text that is no JSON, fails nothing; a key written another way (an escape) is the same key; and no JSON
// file git tracks in this repository holds one. On Linux and on Windows. Node's own modules.
//
//   node tests/json-keys-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 600).replace(/\n/g, "\n     ")}`}`); } };
const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts", "json-keys.mjs");
const tmp = scratchDir("json-keys-test-");
const run = (...files) => spawnSync(process.execPath, [script, ...files], { cwd: tmp, encoding: "utf8" });
const write = (name, text) => { fs.writeFileSync(path.join(tmp, name), text); return name; };

// (each: the file's text, and the lines of the first and the second of the key it holds twice, or null for none)
const CASES = [
  ['{\n  "a": 1,\n  "b": 2,\n  "a": 3\n}\n', [2, 4], "a key twice, the lines of both"],
  ['{ "past": {\n"x": { "mark": 1 },\n"y": 1,\n"x": { "mark": 2 }\n} }', [2, 4], "a key twice inside a nested object"],
  ['{"a": 1, "\\u0061": 2}', [1, 1], "a key and the same key written with an escape"],
  ['{"a": {"k": 1}, "b": {"k": 2}}', null, "the same key in two objects"],
  ['[{"k": 1}, {"k": 2}]', null, "the same key in the objects of an array"],
  ['{"a": "a", "b": ["a", "b", "a"]}', null, "the same text as values"],
  ['{"a": "x\\"a\\": 1, \\"a\\"", "b": 1}', null, "a key written inside a value"],
  ['{"a": 1, "a": ', null, "a text that is no JSON, left to its readers"],
  ['{"k": {"a": 1, "a": 2}, "k2": 1}', [1, 1], "a key twice in an object that is a value"],
];

const { duplicateKeys } = await import("../scripts/json-keys.mjs");
for (const [text, lines, what] of CASES) {
  const found = duplicateKeys(text);
  ok(lines === null ? found.length === 0 : found.length === 1 && found[0].first === lines[0] && found[0].again === lines[1], what, JSON.stringify(found));
}

const clean = write("clean.json", '{"a": 1, "b": {"a": 2}}');
const twice = write("twice.json", '{\n  "mark": 1,\n  "mark": 2\n}\n');
let r = run(clean);
ok(r.status === 0 && /ok /u.test(r.stdout), "a file with no key twice passes", r.stderr);
r = run(twice);
ok(r.status === 1, "a file with a key twice fails", r.stdout + r.stderr);
ok(r.stderr.includes('twice.json holds the key "mark" twice') && r.stderr.includes("lines 2 and 3"), "it says the file, the key and the lines", r.stderr);
ok(mended(r.stderr), "its failure says its mend", r.stderr);
ok(run("none.json").status === 0, "a file that is not there fails nothing", "");
const long = write("long.json", `{"${"k".repeat(200)}": 1, "${"k".repeat(200)}": 2}`);
ok(run(long).stderr.length < 700, "a long key is cut in what it says", run(long).stderr.length);

// every JSON file this repository tracks, as the check reads them with no file named
r = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
ok(r.status === 0, "no JSON file this repository tracks holds a key twice in one object", r.stderr);

console.log(`\n${count - failed}/${count} passed`);
process.exit(failed ? 1 : 0);
