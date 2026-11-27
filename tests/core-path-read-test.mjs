// Tests of how the manifest's reader reads a file (core-path.mjs, regularText and manifestText; #1510): opened once and
// read through that descriptor, never by its path again, within its bound, and a link followed or refused as its
// caller asks. Node's own modules only. The rest of core-path.mjs: core-path-test.mjs.
//
//   node tests/core-path-read-test.mjs
import fs from "node:fs";
import path from "node:path";
import { manifestText, regularText } from "../scripts/core-path.mjs";
import { copied } from "../scripts/core-path-scratch.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();

// (the manifest is opened once and read through that descriptor, never by its path again, so the file checked is the
// file read; the flag that refuses a link as it opens is passed where the reader refuses one)
{
  const one = scratchDir("core-path-read-test-");
  const at = path.join(one, "core-manifest.md");
  fs.writeFileSync(at, copied("vendor/core/"));
  const seen = [], { openSync, readFileSync } = fs;
  fs.openSync = (file, flags, ...rest) => { seen.push(["open", file, flags]); return openSync(file, flags, ...rest); };
  fs.readFileSync = (file, ...rest) => { if (file === at) seen.push(["read", file]); return readFileSync(file, ...rest); };
  let text;
  try { text = manifestText(at, { linked: false }); } finally { Object.assign(fs, { openSync, readFileSync }); }
  const opens = seen.filter(([kind, file]) => kind === "open" && file === at), noFollow = fs.constants.O_NOFOLLOW ?? 0;
  ok(text === copied("vendor/core/") && opens.length === 1 && (opens[0][2] & noFollow) === noFollow && !seen.some(([kind]) => kind === "read"),
    "the manifest is opened once, refusing a link as it opens where the platform can, and read through that one descriptor", JSON.stringify(seen));
  ok(regularText(at, { bound: copied("vendor/core/").length }) === copied("vendor/core/") && regularText(at, { bound: copied("vendor/core/").length - 1 }) === null,
    "a file of the bound exactly is read whole, and one a byte past it is not read");
  if (process.platform !== "win32") { // (a link needs a right Windows may not give)
    fs.symlinkSync("core-manifest.md", path.join(one, "linked.md")); fs.symlinkSync("nowhere.md", path.join(one, "dangling.md"));
    ok(manifestText(path.join(one, "linked.md")) === copied("vendor/core/") && manifestText(path.join(one, "linked.md"), { linked: false }) === ""
      && manifestText(path.join(one, "dangling.md")) === null && manifestText(path.join(one, "dangling.md"), { linked: false }) === "",
      "a link is followed where the reader follows one, and is read as no regular file, leading anywhere or nowhere, where it refuses one");
  }
}

done("how the manifest's reader reads a file");
