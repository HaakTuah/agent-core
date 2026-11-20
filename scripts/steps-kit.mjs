// What the tests of the steps stand on (steps-test.mjs, steps-checks-run-test.mjs, steps-files-test.mjs, steps-tool-
// files-test.mjs): the projects the starter kit of this commit writes in a scratch folder, each a git repository with
// nothing committed, and the timing of a reader's "one pass". Tests only: no project and no workflow of the core's uses
// it. Node's own modules and git only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "./core-address.mjs";
import { hookCommands, readCore } from "./core-path.mjs";
import { READ, TEMPLATES, files, licences, sizes } from "./init.mjs";
import { READERS } from "./shape-readers.mjs";
import { root } from "./scratch-core.mjs";

export const PIN = "a".repeat(40);
const modules = ["roles/shared", "tasks", "tools"].flatMap(d => fs.readdirSync(path.join(root, d)).filter(n => n.endsWith(".md")));

// The kit's project in `name` under `tmp`, written with `o` (init.mjs's options), as `kit(name, o, { at, library, submodule })`
// returns its folder.
export function kitIn(tmp) {
  // (`at`: where the project's copy of the core stands, as its manifest names it, "core/" the default. Its own files then
  // name that path wherever the kit wrote core/, as a project that moved its copy has them: #628. `library`: the folder of a
  // library that carries the core, its files committed here, at `at` inside it, as the manifest's line and the library's
  // own manifest say it, with the floor's own copy in floor-copy/; `submodule`: the library a submodule of the project,
  // which git lists by its commit alone)
  function kit(name, o, { at = "core/", library = null, submodule = false } = {}) {
    const dir = path.join(tmp, name);
    fs.mkdirSync(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    const there = text => at === "core/" ? text : text.replace(/(?<![\w-])core\//gu, at);
    const readAt = f => at === "core/" ? f : f.replace(/^core\//u, at);
    for (const [to, text] of files({ owner: "someone-else", name, ...o }, PIN, modules, n => fs.readFileSync(path.join(root, TEMPLATES, n), "utf8"))) {
      fs.mkdirSync(path.dirname(path.join(dir, there(to))), { recursive: true });
      fs.writeFileSync(path.join(dir, there(to)), there(text));
    }
    if (library) {
      const manifest = path.join(dir, "core-manifest.md"), own = /^Core: .*$/m.exec(fs.readFileSync(manifest, "utf8"))[0];
      fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(own, `Core: ${CORE}, carried by ${library} under ${at} (never edited here).\nFloor copy: floor-copy/`));
      fs.mkdirSync(path.join(dir, library), { recursive: true });
      fs.writeFileSync(path.join(dir, library, "core-manifest.md"), `${own.replace(`under ${at}`, `under ${at.slice(library.length)}`)}\n`);
      fs.cpSync(path.join(root, "floor"), path.join(dir, "floor-copy"), { recursive: true });
    }
    if (at !== "core/") {
      // (its hooks are the commands core-path.mjs gives for that path, which stop a session whose floor cannot be read there)
      const settings = path.join(dir, ".claude/settings.json"), hooks = JSON.parse(fs.readFileSync(settings, "utf8")), commands = hookCommands(readCore(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8")));
      hooks.hooks.SessionStart[0].hooks[0].command = commands.start; hooks.hooks.PreToolUse[0].hooks[0].command = commands.helper; hooks.hooks.Stop[0].hooks[0].command = commands.stop;
      fs.writeFileSync(settings, `${JSON.stringify(hooks, null, 2)}\n`);
    }
    fs.mkdirSync(path.join(dir, "checks"), { recursive: true });
    fs.writeFileSync(path.join(dir, "checks/licences.json"), `${JSON.stringify(licences(o, () => false), null, 2)}\n`);
    // (the copy of the core the project holds, as far as its checks read it, its .gitignore too, which keeps the installed packages out of git as in a
    // synced project, where staging them cost a Windows runner over a minute; and the size marks the kit writes for it)
    for (const part of ["floor", "modules", "roles", "tasks", "tools", "scripts", ".packages", "setup", ".gitignore"]) fs.cpSync(path.join(root, part), path.join(dir, at, part), { recursive: true });
    if (submodule) {
      const lib = path.join(dir, library), git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "protocol.file.allow=always", ...args], { cwd: lib, stdio: "ignore" });
      git("init", "-q", "-b", "main");
      git("add", "-A");
      git("commit", "-q", "-m", "the library");
      execFileSync("git", ["-c", "protocol.file.allow=always", "submodule", "add", "-q", `${lib.replace(/\\/g, "/")}-origin.git`, library.replace(/\/$/, "")], { cwd: dir, stdio: "ignore" });
    }
    // (the files the marks name stand under the copy's path; the total counts the project's own alone, as for core/)
    const marks = sizes(Object.fromEntries(READ.map(f => [f, fs.statSync(path.join(dir, readAt(f))).size])));
    marks.read = Object.fromEntries(Object.entries(marks.read).map(([f, mark]) => [readAt(f), mark]));
    fs.writeFileSync(path.join(dir, "checks/sizes.json"), `${JSON.stringify(marks, null, 2)}\n`);
    execFileSync("git", ["add", "-A"], { cwd: dir });
    // (the copies check's first baseline as the starter kit writes it, its two entry files' shared sentence listed)
    execFileSync(process.execPath, [`${at}scripts/copies.mjs`, "checks/copies.json", "--first"], { cwd: dir, stdio: "ignore" });
    fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), `${JSON.stringify({ reads: Object.keys(READERS), listed: {} }, null, 2)}\n`);
    // (the first list of what holds the project's own rules, as the starter kit writes it: #662)
    execFileSync(process.execPath, [`${at}scripts/holders.mjs`, "--own", "--write"], { cwd: dir, stdio: "ignore" });
    // (a reading of the project against the core, recorded as the pull request of its first reading records it: #464)
    execFileSync(process.execPath, [`${at}scripts/core-reading.mjs`, "--recorded"], { cwd: dir, stdio: "ignore" });
    return dir;
  }
  return kit;
}

// What a reader's "one pass" or its bound means is that its work grows in step with its text (or stops at
// its bound), never a time of its own on a real clock, which a busy machine stretches: `read(n, k)` reads a text of
// size n (its k-th, so that none is read from the reader's memory) and says whether it was read right, or does what
// needs building first and returns what then reads it, which alone is timed; the least of a few readings at each of two
// sizes, taken in turn so that a pause lands on none of them, is compared, the smaller held to at least 10 ms, below
// which a clock tells nothing; and a reader that is linear keeps the larger over the smaller near the sizes' own ratio,
// where one gone quadratic takes it to its square. The sizes are small, so that the parser's own time
// (bash-commands.mjs) stays far from its end however busy the machine. The factor of three and the smaller sizes hold
// "one pass" as "not quadratic at these sizes", a small term that shows only past them unseen.
export const linear = (read, small, large, runs = 5) => {
  read(small, -1)?.call?.(); // (the first reading starts the parser)
  const least = new Map([[small, Infinity], [large, Infinity]]);
  let right = true;
  for (let k = 0; k < runs; k++) for (const n of [small, large]) {
    let at = Date.now(), got = read(n, k);
    if (typeof got === "function") { at = Date.now(); got = got(); }
    right = got && right;
    least.set(n, Math.min(least.get(n), Date.now() - at));
  }
  const ratio = least.get(large) / Math.max(10, least.get(small));
  return { right, linear: ratio < 3 * (large / small), shown: `${small} took ${least.get(small)} ms, ${large} took ${least.get(large)} ms` };
};
