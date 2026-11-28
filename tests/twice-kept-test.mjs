// Tests what --fix of what a project holds twice keeps (scripts/twice.mjs, scripts/twice-files.mjs; tasks/cleaning.md,
// "The reading asks what a project holds twice"; #1087): a file that is no Markdown, one a tool may look for where it
// stands, one in a dot folder; a file another file of the repository names in any form (its file name without the
// extension, in any case, percent-encoded or as character references, in code, through a link, in bytes not UTF-8, in
// the copy or a dated record), listed with that file, and no pointer to it moved; a call a workflow's outputs name;
// nothing read or written through a link, at the path's end or on a folder of its way; and no file of the library that
// carries the core read as the project's own. On the scratch core and project of scripts/twice-scratch.mjs. Node's own modules
// and git.
//
//   node tests/twice-kept-test.mjs
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { linkedAway, inTime, tally } from "../scripts/scratch-core.mjs";
import { CALL, LONE, RUN, fetched, git, project, run, write } from "../scripts/twice-scratch.mjs";

const { ok, done } = tally();
const has = (dir, f) => fs.existsSync(path.join(dir, f));

// What is no Markdown, or a name a tool looks for where it stands, or in a dot folder; a call an output names.
{
  const dir = project("more");
  write(dir, {
    "tools/run.sh": RUN, "docs/README.md": LONE, ".agents/page.md": LONE,
    ".github/workflows/called.yml": `name: called\non:\n  workflow_call:\n    outputs:\n      head:\n        value: \${{ jobs.two.outputs.head }}\njobs:\n  one:\n    uses: ${CALL}\n  two:\n    uses: ${CALL}\n`,
  });
  fs.chmodSync(path.join(dir, "tools/run.sh"), 0o755);
  const r = run(dir, "--fix", ...fetched);
  ok(/tools\/run\.sh .*it is no Markdown, which may be run or found where it stands/u.test(r.stdout) && has(dir, "tools/run.sh") && has(dir, "tools/a.mjs"), "what is no Markdown is listed and stays", r.stdout);
  ok(/docs\/README\.md .*a tool may look for it where it stands/u.test(r.stdout) && /\.agents\/page\.md .*a tool may look for it where it stands/u.test(r.stdout) && has(dir, "docs/README.md") && has(dir, ".agents/page.md"), "a name a tool looks for in its folder, and a file in a dot folder, stay", r.stdout);
  ok(fs.readFileSync(path.join(dir, ".github/workflows/called.yml"), "utf8").includes("  two:"), "a call a workflow's outputs name stays");
}

// A file another file of the repository names, in any form, stays, listed with that file, and nothing is written.
const FORMS = {
  "code that reads it beside itself": ["notes/read.mjs", `export const page = new URL("zephyr-notes.md", import.meta.url);\n`],
  "its name without the extension, in another case": ["tools/list.txt", "Pages: ZEPHYR-NOTES and others.\n"],
  "percent-encoded": ["docs/page.md", "# Page\n\nSee [the notes](../notes/zephyr%2Dnotes%2Emd).\n"],
  "percent-encoded twice": ["docs/twice.md", "# Page\n\nSee [the notes](../notes/zephyr%252Dnotes.md).\n"],
  "as numeric character references": ["docs/page.html", "<a href=\"../notes/&#x7A;ephyr&#45;notes.md\">notes</a>\n"],
  "with a named character reference": ["docs/named.html", "<a href=\"../notes/zephyr&hyphen;notes.md\">notes</a>\n"],
  "through a link": ["alias.md", null],
  "in bytes not UTF-8": ["data.bin", Buffer.concat([Buffer.from([0xff, 0xfe, 0x80]), Buffer.from(" zephyr-notes")])],
  "in UTF-16": ["notes.txt", Buffer.from("﻿See zephyr-notes.md.\n", "utf16le")],
  "in the copy": ["core/docs/more.md", "# More\n\nThe notes stand at zephyr-notes.md.\n"],
  "in a dated record": ["reports/2026-11-02.md", "# A report\n\nIt read notes/zephyr-notes.md.\n"],
};
for (const [form, [file, content]] of Object.entries(FORMS)) {
  const dir = project(`named-${file.replace(/[^a-z0-9]/giu, "-")}`);
  if (content === null) fs.symlinkSync("notes/zephyr-notes.md", path.join(dir, file));
  else write(dir, { [file]: content });
  const before = content === null ? null : fs.readFileSync(path.join(dir, file));
  const r = run(dir, "--fix", ...fetched);
  const listed = new RegExp(`^  notes/zephyr-notes\\.md is the core's docs/zephyr-notes\\.md, byte for byte; ${file.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")} names it, so it stays for the auditor$`, "mu").test(r.stdout);
  ok(listed && has(dir, "notes/zephyr-notes.md") && (before === null || fs.readFileSync(path.join(dir, file)).equals(before)), `a file named ${form} stays, listed with the file that names it, which is not written`, r.stdout);
}

// A pointer moved is never written through a link into the copy.
{
  const dir = project("linked");
  write(dir, { "core/docs/ref.md": "# A reference\n\nIt names core/old/place.md, which the core moved.\n" });
  fs.symlinkSync("core/docs/ref.md", path.join(dir, "linked.md"));
  run(dir, "--fix", ...fetched);
  ok(fs.readFileSync(path.join(dir, "core/docs/ref.md"), "utf8").includes("core/old/place.md"), "nothing is written through a link into the copy");
}

// Nothing is taken out or written through a folder on the path's way that is a link, nor through a workflow that is one.
{
  const dir = project("linked-folder");
  write(dir, { "docs2/zephyr-notes.md": LONE });
  git(dir, "add", "docs2");
  fs.rmSync(path.join(dir, "docs2"), { recursive: true });
  fs.symlinkSync("core/docs", path.join(dir, "docs2"));
  fs.symlinkSync("own.yml", path.join(dir, ".github/workflows/twin.yml"));
  const r = run(dir, "--fix", ...fetched);
  ok(has(dir, "core/docs/zephyr-notes.md") && !/docs2\//u.test(r.stdout), "nothing is taken out through a folder that is a link", r.stdout);
  ok(!/twin\.yml/u.test(r.stdout) && fs.lstatSync(path.join(dir, ".github/workflows/twin.yml")).isSymbolicLink(), "a workflow that is a link is not read as the project's own", r.stdout);
}

// A link the system reads out of the project, though its spelling stays inside, is a link.
{
  const dir = project("folded");
  if (linkedAway(dir, "loop.md")) {
    const said = inTime(`import { linked } from ${JSON.stringify(new URL("../scripts/twice-files.mjs", import.meta.url).href)};\nconsole.log(linked({ root: ${JSON.stringify(dir)} }, "loop.md"));`);
    ok(said?.trim() === "true", "a link the system reads out of the project, though its spelling stays inside, is read as a link", said ?? "stopped past its time");
  }
}

// The library that carries the core is another repository's: none of its files is read as the project's own.
{
  const dir = project("carried");
  fs.mkdirSync(path.join(dir, "shelf"));
  fs.renameSync(path.join(dir, "core"), path.join(dir, "shelf/core"));
  write(dir, { "core-manifest.md": `# The core manifest\n\nCore: ${CORE}, carried by shelf/ under shelf/core/\n`, "shelf/page.md": LONE });
  const r = run(dir, "--fix");
  ok(has(dir, "shelf/page.md") && !/shelf\/page\.md/u.test(r.stdout) && !has(dir, "notes/zephyr-notes.md"), "a file of the library that carries the core is neither listed nor taken out", r.stdout);
}

done("what --fix of what a project holds twice keeps");
