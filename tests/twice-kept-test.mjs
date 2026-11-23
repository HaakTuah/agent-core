// Tests what --fix of what a project holds twice cannot follow, and so keeps (scripts/twice.mjs, scripts/twice-files.mjs;
// tasks/cleaning.md, "The reading asks what a project holds twice"; #1087): a file that is no Markdown, one a tool may
// look for where it stands, one named in a form the script does not move, through a link, from another folder, from a
// folder that holds a file of that path of its own, or in bytes not UTF-8, and one a link leads to; a call a workflow's
// outputs name; and a workflow's path opening with ./, which it does move. On the scratch core and project of
// tests/twice-fixture.mjs. Node's own modules and git.
//
//   node tests/twice-kept-test.mjs
import fs from "node:fs";
import path from "node:path";
import { tally } from "../scripts/scratch-core.mjs";
import { CALL, GUIDE_NEW, RUN, fetched, project, run, write } from "./twice-fixture.mjs";

const { ok, done } = tally();
const reader = dir => f => fs.readFileSync(path.join(dir, f), "utf8");

// What is no Markdown, or a name a tool looks for where it stands, or in a dot folder; one named in a form not moved or
// through a link; a call an output names.
{
  const dir = project("more");
  write(dir, {
    "tools/run.sh": RUN, "docs/README.md": GUIDE_NEW, ".agents/guide.md": GUIDE_NEW,
    "MORE.md": "# More\n\nRun `cat $ROOT/docs/guide.md` to read it.\n",
    ".github/workflows/called.yml": `name: called\non:\n  workflow_call:\n    outputs:\n      head:\n        value: \${{ jobs.two.outputs.head }}\njobs:\n  one:\n    uses: ${CALL}\n  two:\n    uses: ${CALL}\n`,
  });
  fs.chmodSync(path.join(dir, "tools/run.sh"), 0o755);
  fs.symlinkSync("core/docs/ref.md", path.join(dir, "linked.md"));
  const r = run(dir, "--fix", ...fetched), read = reader(dir), has = f => fs.existsSync(path.join(dir, f));
  ok(/tools\/run\.sh .*it is no Markdown, which may be run or found where it stands/u.test(r.stdout) && has("tools/run.sh") && has("tools/a.mjs"), "what is no Markdown is listed and stays", r.stdout);
  ok(/docs\/README\.md .*a tool may look for it where it stands/u.test(r.stdout) && /\.agents\/guide\.md .*a tool may look for it where it stands/u.test(r.stdout) && has("docs/README.md") && has(".agents/guide.md"), "a name a tool looks for in its folder, and a file in a dot folder, stay", r.stdout);
  ok(read(".github/workflows/called.yml").includes("  two:"), "a call a workflow's outputs name stays", read(".github/workflows/called.yml"));
  ok(/docs\/guide\.md .*(?:MORE\.md|linked\.md) names it in a form the script cannot move/u.test(r.stdout) && has("docs/guide.md"), "a file named in a form not moved, or through a link, stays", r.stdout);
  ok(read("core/docs/ref.md").includes("at docs/guide.md,"), "nothing is written through a link into the copy");
}

// A workflow's path from the root opening with ./ moves, and the file goes.
{
  const dir = project("dot");
  write(dir, { ".github/workflows/dot.yml": "name: dot\non: push\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - run: cat ./docs/guide.md\n" });
  run(dir, "--fix", ...fetched);
  ok(reader(dir)(".github/workflows/dot.yml").includes("cat ./core/docs/guide.md") && !fs.existsSync(path.join(dir, "docs/guide.md")), "a workflow's path from the root opening with ./ moves", reader(dir)(".github/workflows/dot.yml"));
}

// A link's own text keeps the file it names, and the copy it leads into is not written.
{
  const dir = project("linked");
  fs.symlinkSync("core/docs/ref.md", path.join(dir, "linked.md"));
  const r = run(dir, "--fix", ...fetched);
  ok(/docs\/guide\.md .*linked\.md names it/u.test(r.stdout) && reader(dir)("core/docs/ref.md").includes("at docs/guide.md,"), "a link's text keeps the file it names, and the copy is not written", r.stdout);
}

// A file a link leads to, or a folder of it, stays.
{
  const dir = project("alias");
  fs.symlinkSync("guide.md", path.join(dir, "docs/alias.md"));
  fs.symlinkSync("docs", path.join(dir, "kit"));
  const r = run(dir, "--fix", ...fetched);
  ok(/docs\/guide\.md .*the link (?:docs\/alias\.md|kit) leads to it/u.test(r.stdout) && fs.existsSync(path.join(dir, "docs/guide.md")), "a file a link leads to, or a folder of it, stays", r.stdout);
}

// A file a workflow names from another folder (its working-directory) stays.
{
  const dir = project("named");
  write(dir, { ".github/workflows/wd.yml": "on: push\njobs:\n  t:\n    runs-on: x\n    defaults: { run: { working-directory: docs } }\n    steps:\n      - run: cat ./guide.md\n" });
  const r = run(dir, "--fix", ...fetched);
  ok(/docs\/guide\.md .*wd\.yml names it/u.test(r.stdout) && fs.existsSync(path.join(dir, "docs/guide.md")), "a file a workflow names from another folder stays", r.stdout);
}

// A file named in bytes not UTF-8 stays, and those bytes are not written.
{
  const dir = project("bytes");
  const bin = Buffer.concat([Buffer.from([0xff, 0xfe, 0x80]), Buffer.from(" docs/guide.md")]);
  fs.writeFileSync(path.join(dir, "data.bin"), bin);
  const r = run(dir, "--fix", ...fetched);
  ok(/docs\/guide\.md .*data\.bin names it/u.test(r.stdout) && fs.readFileSync(path.join(dir, "data.bin")).equals(bin), "a file named in bytes not UTF-8 stays, and those bytes are not written", r.stdout);
}

// A path that, read from the folder of the file that holds it, names a file of that folder's own is no pointer to the
// root's: neither moved nor taken for one, so the root's file stays.
{
  const dir = project("relative");
  const notes = "# Notes\n\nSee docs/guide.md, which stands beside this file.\n";
  write(dir, { "app/docs/guide.md": "# App guide\n\nThe app's own guide, which the core never held.\n", "app/notes.md": notes });
  const r = run(dir, "--fix", ...fetched);
  ok(/docs\/guide\.md .*app\/notes\.md names it/u.test(r.stdout) && fs.existsSync(path.join(dir, "docs/guide.md")) && reader(dir)("app/notes.md") === notes, "a path the caller's folder holds a file of its own at stays as it was, and so does the root's file", r.stdout);
}

done("what --fix of what a project holds twice keeps");
