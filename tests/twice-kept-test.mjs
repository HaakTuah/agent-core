// Tests what --fix of what a project holds twice cannot follow, and so keeps (scripts/twice.mjs, scripts/twice-files.mjs;
// tasks/cleaning.md, "The reading asks what a project holds twice"; #1087): a file run as a program where the copy's is
// not, one named in a form the script does not move, through a link, from another folder or in bytes not UTF-8, and
// one a link leads to; a call a workflow's outputs name; and a workflow's path opening with ./, which it does move. On
// the scratch core and project of tests/twice-fixture.mjs. Node's own modules and git.
//
//   node tests/twice-kept-test.mjs
import fs from "node:fs";
import path from "node:path";
import { tally } from "../scripts/scratch-core.mjs";
import { CALL, RUN, fetched, project, run, write } from "./twice-fixture.mjs";

const { ok, done } = tally();
const reader = dir => f => fs.readFileSync(path.join(dir, f), "utf8");

// One run as a program where the copy's is not, one named in a form not moved or through a link; a call an output names.
{
  const dir = project("more");
  write(dir, {
    "tools/run.sh": RUN, ".github/workflows/dot.yml": "name: dot\non: push\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node ./tools/a.mjs && tools/run.sh x\n",
    "MORE.md": "# More\n\nRun `cat $ROOT/docs/guide.md` to read it.\n",
    ".github/workflows/called.yml": `name: called\non:\n  workflow_call:\n    outputs:\n      head:\n        value: \${{ jobs.two.outputs.head }}\njobs:\n  one:\n    uses: ${CALL}\n  two:\n    uses: ${CALL}\n`,
  });
  fs.chmodSync(path.join(dir, "tools/run.sh"), 0o755);
  fs.symlinkSync("core/docs/ref.md", path.join(dir, "linked.md"));
  const r = run(dir, "--fix", ...fetched), read = reader(dir);
  ok(/tools\/run\.sh is the core's scripts\/run\.sh, byte for byte; it may be run as a program and the copy's file may not/u.test(r.stdout) && fs.existsSync(path.join(dir, "tools/run.sh")), "a file run as a program stays where the copy's is not", r.stdout);
  ok(read(".github/workflows/called.yml").includes("  two:"), "a call a workflow's outputs name stays", read(".github/workflows/called.yml"));
  ok(read(".github/workflows/dot.yml").includes("node ./core/scripts/a.mjs") && !fs.existsSync(path.join(dir, "tools/a.mjs")), "a workflow's path from the root opening with ./ moves", read(".github/workflows/dot.yml"));
  ok(/docs\/guide\.md .*(?:MORE\.md|linked\.md) names it in a form the script cannot move/u.test(r.stdout) && fs.existsSync(path.join(dir, "docs/guide.md")), "a file named in a form not moved, or through a link, stays", r.stdout);
  ok(read("core/docs/ref.md").includes("at docs/guide.md,"), "nothing is written through a link into the copy");
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
  fs.symlinkSync("a.mjs", path.join(dir, "tools/alias.mjs"));
  fs.symlinkSync("tools", path.join(dir, "kit"));
  const r = run(dir, "--fix", ...fetched);
  ok(/tools\/a\.mjs .*the link (?:tools\/alias\.mjs|kit) leads to it/u.test(r.stdout) && fs.existsSync(path.join(dir, "tools/a.mjs")) && fs.existsSync(path.join(dir, "tools/b.mjs")), "a file a link leads to, or a folder of it, stays", r.stdout);
}

// A file a workflow names from another folder (its working-directory), or one named in bytes not UTF-8, stays, and
// those bytes are not written.
{
  const dir = project("named");
  const bin = Buffer.concat([Buffer.from([0xff, 0xfe, 0x80]), Buffer.from(" docs/guide.md")]);
  write(dir, { ".github/workflows/wd.yml": "on: push\njobs:\n  t:\n    runs-on: x\n    defaults: { run: { working-directory: tools } }\n    steps:\n      - run: node ./b.mjs\n" });
  fs.writeFileSync(path.join(dir, "data.bin"), bin);
  const r = run(dir, "--fix", ...fetched);
  ok(/tools\/b\.mjs .*wd\.yml names it/u.test(r.stdout) && fs.existsSync(path.join(dir, "tools/b.mjs")) && fs.existsSync(path.join(dir, "tools/a.mjs")), "a file a workflow names from another folder stays, and the code that names it", r.stdout);
  ok(/docs\/guide\.md .*data\.bin names it/u.test(r.stdout) && fs.readFileSync(path.join(dir, "data.bin")).equals(bin), "a file named in bytes not UTF-8 stays, and those bytes are not written", r.stdout);
}

done("what --fix of what a project holds twice keeps");
