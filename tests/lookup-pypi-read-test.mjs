#!/usr/bin/env node
// Tests of how the lookup's part for PyPI (lookup-pypi.mjs; #716) reads a requirements file where its own text could
// make it say less than it seems to (#1368, points 2 and 4): "# via" lines that would hide a package from GitHub's check,
// and long runs of spaces. Each package name invented, no network. The rest of the reader, and what PyPI says, are
// lookup-pypi-test.mjs's. Run: node tests/lookup-pypi-read-test.mjs
import { quick } from "../scripts/hostile.mjs";
import { pypiPackages } from "../scripts/lookup-pypi.mjs";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } };
const throws = (f) => { try { f(); return ""; } catch (e) { return e.message; } };
// (a hash of PyPI's form, its bytes invented)
const H = (c = "a") => `--hash=sha256:${c.repeat(64)}`;

// (#1368, point 2: the "# via" lines are the pull request's own text, so none of them hides a package from GitHub's check)
const looped = pypiPackages([
  `self-moss==1.0.0 ${H()}`, "    # via self-moss",
  `ring-moss==1.0.0 ${H()}`, "    # via loop-moss",
  `loop-moss==1.0.0 ${H()}`, "    # via ring-moss",
  `root-moss==1.0.0 ${H()}`, "    # via -r requirements.in",
  `fed-moss==1.0.0 ${H()}`, "    # via", "    #   feed-moss", "    #   root-moss",
  `feed-moss==1.0.0 ${H()}`, "    # via fed-moss",
].join("\n"), "requirements.txt");
const loop = (name) => looped.find((p) => p.name === name);
ok(loop("self-moss")?.direct === true && loop("ring-moss")?.direct === true && loop("loop-moss")?.direct === true, `a package "# via" itself, and a cycle that no package the project names leads into, are named by the project (${JSON.stringify(looped.map((p) => [p.name, p.direct]))})`);
ok(loop("fed-moss")?.direct === false && loop("feed-moss")?.direct === false && loop("fed-moss")?.by.join() === "root-moss" && loop("feed-moss")?.by.join() === "root-moss", `a cycle that a package the project names leads into is brought by it (${JSON.stringify(looped.map((p) => [p.name, p.direct, p.by]))})`);
// (#1368, point 4: a long run of spaces is read in one pass, never by trying each split of it)
for (const [what, line] of [["a comment's strip", `plain-moss==1.0.0${" ".repeat(200000)}x`], ["a requirement", `plain-moss${" ".repeat(200000)}x ${H()}`], ["a requirement's version", `plain-moss ==${" ".repeat(200000)}; ${H()}`]]) {
  ok(quick(() => throws(() => pypiPackages(`${line}\n`, "requirements.txt"))), `${what} on a run of 200,000 spaces is refused, quickly, not after one try for each split of it`);
}
ok(quick(() => !throws(() => pypiPackages(`root-moss==1.0.0 ${H()}\n    # via ${Array.from({ length: 200000 }, (_, i) => `m${i}`).join(" ")}\n`, "requirements.txt"))), "a \"# via\" list of 200,000 names is read, quickly, never spread into one call");
ok(pypiPackages(`plain-moss==1.0.0 ${H()}   # a note # and another\n`, "r.txt")[0]?.hashes.length === 1, "a comment after a requirement is taken off from its first \"#\" after a space, the spaces before it too");

console.log(failed ? `${failed} failing` : "ok   lookup-pypi.mjs on a file's own text");
process.exit(failed ? 1 : 0);
