// Tests of how the manifest's reader reads a file (core-path.mjs, regularText and manifestText; #1510), and a
// project's own file (ownText): opened once and
// read through that descriptor, never by its path again, within its bound, and a link followed or refused as its
// caller asks. Node's own modules only. The rest of core-path.mjs: core-path-test.mjs.
//
//   node tests/core-path-read-test.mjs
import fs from "node:fs";
import path from "node:path";
import { manifestText, ownText, regularText } from "../scripts/core-path.mjs";
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
  ok(regularText(at, { bound: Buffer.byteLength(copied("vendor/core/")) }) === copied("vendor/core/") && regularText(at, { bound: Buffer.byteLength(copied("vendor/core/")) - 1 }) === null,
    "a file of the bound exactly is read whole, and one a byte past it is not read");
  if (process.platform !== "win32") { // (a link needs a right Windows may not give)
    fs.symlinkSync("core-manifest.md", path.join(one, "linked.md")); fs.symlinkSync("nowhere.md", path.join(one, "dangling.md"));
    ok(manifestText(path.join(one, "linked.md")) === copied("vendor/core/") && manifestText(path.join(one, "linked.md"), { linked: false }) === ""
      && manifestText(path.join(one, "dangling.md")) === null && manifestText(path.join(one, "dangling.md"), { linked: false }) === "",
      "a link is followed where the reader follows one, and is read as no regular file, leading anywhere or nowhere, where it refuses one");
  }
}

// (where the reader follows a link, what it leads to is looked at before it is opened: a device, or a link to one, is not
// opened, and reads as no regular file; /dev/null stands for any device, whose opening does nothing)
if (process.platform !== "win32") { // (a device at that path and a link need what Windows may not give)
  const dir = scratchDir("core-path-read-device-"), device = "/dev/null", linked = path.join(dir, "core-manifest.md");
  fs.symlinkSync(device, linked);
  const opened = [], { openSync } = fs;
  fs.openSync = (file, ...rest) => { opened.push(file); return openSync(file, ...rest); };
  let texts;
  try { texts = [manifestText(linked), manifestText(device), regularText(linked)]; } finally { fs.openSync = openSync; }
  ok(texts[0] === "" && texts[1] === "" && texts[2] === null && opened.length === 0,
    "a device, or a link that leads to one, is not opened where the reader follows a link, and reads as no regular file", JSON.stringify({ texts, opened }));
}

// (where the reader follows a link, the file opened must be the file looked at: one that is another is not read)
{
  const at = path.join(scratchDir("core-path-read-other-"), "core-manifest.md");
  fs.writeFileSync(at, copied("vendor/core/"));
  const { statSync } = fs;
  fs.statSync = (file, ...rest) => { const seen = statSync(file, ...rest); return file === at ? Object.assign(seen, { ino: seen.ino === 0 ? 1 : 0 }) : seen; };
  let text;
  try { text = regularText(at); } finally { fs.statSync = statSync; }
  ok(text === null, "a file opened that is not the one looked at is not read", JSON.stringify(text));
}

// (a file of the project's own: a link inside it followed, one out of it, to a folder or a device, or nowhere, read as
// none)
if (process.platform !== "win32") {
  const top = scratchDir("core-path-own-"), away = scratchDir("core-path-away-");
  try {
    fs.writeFileSync(path.join(top, "a.md"), "inside\n"); fs.writeFileSync(path.join(away, "b.md"), "outside\n"); fs.mkdirSync(path.join(top, "dir"));
    for (const [to, f] of [["a.md", "in.md"], [path.join(away, "b.md"), "out.md"], ["dir", "folder.md"], ["/dev/zero", "zero.md"], ["gone.md", "gone-link.md"]]) fs.symlinkSync(to, path.join(top, f));
    const own = f => ownText(path.join(top, f), { root: top });
    ok(own("a.md") === "inside\n" && own("in.md") === "inside\n" && ["out.md", "folder.md", "zero.md", "gone-link.md", "none.md"].every(f => own(f) === null),
      "a file of the project's own is read, a link inside it as the file it leads to; a link out of it, to a folder, to a device or nowhere, reads as none");
    ok(ownText(path.join(top, "a.md"), { root: top, bound: 6 }) === null, "and one past its bound reads as none");
    fs.mkdirSync(path.join(away, "sub")); fs.writeFileSync(path.join(top, "b.md"), "inside\n"); fs.symlinkSync(path.join(away, "sub"), path.join(top, "lnk"));
    ok(ownText(`${top}/lnk/../b.md`, { root: top }) === null, "a path given with a `..` after a link out of the project reads as none, though its spelling names a file inside it");
  } finally { fs.rmSync(top, { recursive: true, force: true }); fs.rmSync(away, { recursive: true, force: true }); }
}

done("how the manifest's reader reads a file");
