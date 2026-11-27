#!/usr/bin/env node
// Tests of how the lookup's part for PyPI (lookup-pypi.mjs; #716) reads a requirements file where its own text could
// make it say less than it seems to (#1368, points 2 and 4): "# via" lines that would hide a package from GitHub's check,
// and long runs of spaces. Each package name invented, no network. The rest of the reader, and what PyPI says, are
// lookup-pypi-test.mjs's. Run: node tests/lookup-pypi-read-test.mjs
import { quick } from "../scripts/hostile.mjs";
import { pypiGraphed, pypiPackages, pypiRequires } from "../scripts/lookup-pypi.mjs";

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
const twice = pypiPackages([`root-moss==1.0.0 ${H()}`, `target-moss==1.0.0 ; python_version < "3.9" ${H()}`, "    # via -r requirements.in", `target-moss==1.0.0 ; python_version >= "3.9" ${H()}`, "    # via root-moss"].join("\n"), "requirements.txt");
ok(twice.filter((p) => p.name === "target-moss").map((p) => p.direct).join() === "true,false", `a name the file gives twice keeps each line's own reading, the line that names it named by the project (${JSON.stringify(twice.map((p) => [p.name, p.direct]))})`);
const both = pypiPackages([`root-moss==1.0.0 ${H()}`, `x-moss==1.0.0 ; python_version < "3.9" ${H()}`, "    # via root-moss", `x-moss==1.0.0 ; python_version >= "3.9" ${H()}`, "    # via x-moss"].join("\n"), "requirements.txt");
ok(both.filter((p) => p.name === "x-moss").every((p) => !p.direct && p.by.join() === "root-moss"), `a name the file gives twice is brought by what either of its lines names, the last line alone never deciding (${JSON.stringify(both.map((p) => [p.name, p.direct, p.by]))})`);
// (#1388, point 2: a "# via" parent brings a package only where PyPI lists it as requiring it; `keep` stands for that
// reading, which the lookup makes)
const claimed = pypiPackages([
  `root-moss==1.0.0 ${H()}`, "    # via -r requirements.in",
  `real-moss==1.0.0 ${H()}`, "    # via root-moss",
  `claimed-moss==1.0.0 ${H()}`, "    # via root-moss",
  `half-moss==1.0.0 ${H()}`, "    # via", "    #   real-moss", "    #   root-moss",
  `ring-a-moss==1.0.0 ${H()}`, "    # via", "    #   ring-b-moss", "    #   root-moss",
  `ring-b-moss==1.0.0 ${H()}`, "    # via ring-a-moss",
].join("\n"), "requirements.txt");
const requires = { "root-moss": ["real-moss", "half-moss"], "real-moss": [], "ring-a-moss": ["ring-b-moss"], "ring-b-moss": ["ring-a-moss"] };
const checked = pypiGraphed(claimed, (parent, child) => (requires[parent] ?? []).includes(child));
const c = (name) => checked.find((p) => p.name === name);
ok(c("real-moss")?.direct === false && c("real-moss")?.by.join() === "root-moss" && !c("real-moss")?.unborne.length, `a parent PyPI lists as requiring it brings it (${JSON.stringify(c("real-moss"))})`);
ok(c("claimed-moss")?.direct === true && c("claimed-moss")?.unborne.join() === "root-moss" && !c("claimed-moss")?.by.length, `a parent that PyPI does not list as requiring it brings nothing, and the package is named by the project, the parent given (${JSON.stringify(c("claimed-moss"))})`);
ok(c("half-moss")?.direct === false && c("half-moss")?.unborne.join() === "real-moss", `a package one of whose parents requires it is brought, the other parent given (${JSON.stringify(c("half-moss"))})`);
ok(c("ring-a-moss")?.direct === true && c("ring-b-moss")?.direct === true, `a cycle whose members require each other, and that no parent PyPI bears out leads into, is named by the project (${JSON.stringify(checked.map((p) => [p.name, p.direct]))})`);
ok(c("root-moss")?.brings === 2, `what a package brings counts only the parents PyPI bears out (${c("root-moss")?.brings})`);
const answer = { "https://pypi.org/pypi/root-moss/1.0.0/json": { status: 200, json: { info: { requires_dist: ["Real_Moss[x] (>=1.0)", "half.moss ; extra == 'fast'", " other-moss>=2;python_version<'3.9'", 7, "-not-a-name"] } } } };
const requested = [];
const pypiGet = async (url) => { requested.push(url); return answer[url] ?? { status: 404 }; };
const listed = await pypiRequires("Root_Moss", "1.0.0", pypiGet);
ok([...listed].join() === "real-moss,half-moss,other-moss", `what a parent requires is read from PyPI's "requires_dist", each name as pip compares it, an extra's too (${[...listed]})`);
ok(!(await pypiRequires("root-moss", "9.9.9", pypiGet)).size && !(await pypiRequires("root-moss", "1.0.0", async () => { throw new Error("down"); })).size, "a version PyPI does not know, or no answer, requires nothing");
requested.length = 0;
ok(!(await pypiRequires("bad/../name", "1.0.0", pypiGet)).size && !requested.length, "a name PyPI never gives is not asked of it");
// (#1388, point 3: what each package brings, and what brings it, read for all in one pass)
for (const links of [3000, 20000]) {
  const chain = [`l0-moss==1.0.0 ${H()}`, "    # via -r requirements.in", ...Array.from({ length: links }, (_, i) => [`l${i + 1}-moss==1.0.0 ${H()}`, `    # via l${i}-moss`]).flat()].join("\n");
  let total = 0;
  ok(quick(() => { for (const p of pypiPackages(chain, "requirements.txt")) total += p.brings + p.by.length; return true; }) && total === (links * (links + 1)) / 2 + links, `every package of a "# via" chain of ${links} links is read, what it brings and what brings it, quickly (${total})`);
}

// (the graphs whose every node an earlier closure held a set of bits for, as wide as the graph: none is held where
// nothing leads anywhere, and a set many share is put in order once)
const via = (name, ...parents) => [`${name}-moss==1.0.0 ${H()}`, "    # via", ...parents.map((p) => `    #   ${p}`)];
const reads = (what, lines, sum) => {
  let total = 0;
  ok(quick(() => { for (const p of pypiPackages(lines.join("\n"), "requirements.txt")) total += p.brings + p.by.length; return true; }) && total === sum, `${what} is read, what each brings and what brings it, quickly (${total})`);
};
reads("a file of 100,000 packages that each name alone", Array.from({ length: 100000 }, (_, i) => via(`i${i}`, "-r requirements.in")).flat(), 0);
reads("a file of 40,000 cycles of two", Array.from({ length: 40000 }, (_, i) => [...via(`a${i}`, `b${i}-moss`), ...via(`b${i}`, `a${i}-moss`)]).flat(), 80000);
reads("a chain of 50,000 under 50,000 packages the project names", [...Array.from({ length: 50000 }, (_, i) => via(`n${i}`, "-r requirements.in")).flat(), ...via("h", ...Array.from({ length: 50000 }, (_, i) => `n${i}-moss`)), ...Array.from({ length: 50000 }, (_, i) => via(`c${i}`, i ? `c${i - 1}-moss` : "h-moss")).flat()], 50000 * 50001 + 50000 * 50001 + 1250025000);
const ladder = Array.from({ length: 40000 }, (_, i) => via(`l${i}`, ...(i ? [`l${i - 1}-moss`] : ["-r requirements.in"]), ...(i > 1 ? [`l${i - 2}-moss`] : []))).flat();
let top;
ok(quick(() => (top = pypiPackages(ladder.join("\n"), "requirements.txt")).length === 40000) && top[0].brings === undefined, `a graph whose paths are past what the closure counts is given up within its bound, what each brings left unsaid (${top?.[0]?.brings})`);
// (a cycle that holds a package the project names, under 50,000 it names: each brought package's answer is gathered
// once, and past what the answers hold in all none is given, never one copied for each package)
const hub = (cycles) => [...Array.from({ length: 50000 }, (_, i) => via(`n${i}`, "-r requirements.in")).flat(), ...via("h", ...Array.from({ length: 50000 }, (_, i) => `n${i}-moss`)), ...Array.from({ length: cycles }, (_, j) => [...via(`x${j}`, "h-moss", `r${j}-moss`), ...via(`r${j}`, "-r requirements.in", `x${j}-moss`)]).flat()];
for (const [cycles, told] of [[50, true], [5000, false]]) {
  let xs;
  ok(quick(() => (xs = pypiPackages(hub(cycles).join("\n"), "requirements.txt").filter((p) => p.name.startsWith("x"))).every((p) => (told ? p.by?.length === 50001 : p.by === undefined))), `${cycles} cycles under 50,000 named packages, each holding one the project names: ${told ? "what brings each is said" : "what brings each is past what the answers hold, left unsaid"}, quickly (${xs?.[0]?.by?.length})`);
}
const many = Array.from({ length: 100000 }, (_, i) => ({ name: `m${i}-moss`, version: "1.0.0", hashes: [], via: ["-r requirements.in"] }));
let lone;
ok(quick(() => (lone = pypiGraphed([...many, { name: "lone-moss", version: "1.0.0", hashes: [], via: many.map((m) => m.name) }], () => false).at(-1)).unborne.length === 100000) && lone.direct, `a package whose "# via" names 100,000 packages, none of which PyPI bears out, gives each once, quickly (${lone?.unborne.length})`);
// (#1368, point 4: a long run of spaces is read in one pass, never by trying each split of it)
for (const [what, line] of [["a comment's strip", `plain-moss==1.0.0${" ".repeat(200000)}x`], ["a requirement", `plain-moss${" ".repeat(200000)}x ${H()}`], ["a requirement's version", `plain-moss ==${" ".repeat(200000)}; ${H()}`]]) {
  ok(quick(() => throws(() => pypiPackages(`${line}\n`, "requirements.txt"))), `${what} on a run of 200,000 spaces is refused, quickly, not after one try for each split of it`);
}
ok(quick(() => !throws(() => pypiPackages(`root-moss==1.0.0 ${H()}\n    # via ${Array.from({ length: 200000 }, (_, i) => `m${i}`).join(" ")}\n`, "requirements.txt"))), "a \"# via\" list of 200,000 names is read, quickly, never spread into one call");
ok(pypiPackages(`plain-moss==1.0.0 ${H()}   # a note # and another\n`, "r.txt")[0]?.hashes.length === 1, "a comment after a requirement is taken off from its first \"#\" after a space, the spaces before it too");

console.log(failed ? `${failed} failing` : "ok   lookup-pypi.mjs on a file's own text");
process.exit(failed ? 1 : 0);
