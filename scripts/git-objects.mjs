// What git holds at a commit, read through one long-lived `git cat-file --batch` (and `--batch-check`) a repository,
// never a git process a file (#732): the agent-tools check asks for a few thousand objects a run, which on Windows cost a
// process each. Node's own modules and git only.
//
// The reader is synchronous, as the check is: a worker thread owns the git processes and the caller waits on it
// (Atomics.wait), so nothing here is a promise. Wherever the batch cannot answer exactly as the single call did (a path
// that holds a line's end, one git reads relative to a folder, a repository found by walking up from the root, git's own
// variables set, a checkout another user owns, an object that is no file, a worker or a process that fails) the single call
// is made. A batch answer differs from `git show`'s only where git read a name as something else than a file's: a
// revision range ("b..main", "..") or a path filter ("*"), which the batch answers as the file or as nothing.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MessageChannel, SHARE_ENV, Worker, isMainThread, receiveMessageOnPort, workerData } from "node:worker_threads";
import { textAt as showAt } from "./licences.mjs";

const OLDEST_KEPT = 4; // (the processes kept at once; the one asked least recently is closed)
// (the bound `git show` was read to: a larger file is as good as unread; lowered by the variable for a test)
const textMax = () => (Number(process.env.GIT_OBJECTS_TEXT_MAX) > 0 ? Number(process.env.GIT_OBJECTS_TEXT_MAX) : 1 << 28);

// ---- the worker: one process for each repository and way of asking, a line in and its answer out ----
function serve({ port, flag }) {
  const live = new Map();
  const start = (key, args) => {
    const child = spawn("git", args, { stdio: ["pipe", "pipe", "ignore"] }), p = { child, chunks: [], have: 0, head: null, wait: null };
    const done = reply => { const w = p.wait; p.wait = null; p.chunks = []; p.have = 0; p.head = null; if (w) w(reply); };
    // (a process that exits leaves the table, if it is still the one the key names: the key may be started again)
    const gone = () => { if (live.get(key) === p) live.delete(key); done({ failed: true }); };
    // (a body past the bound is answered by its header alone, and the process, still writing it, is never asked again)
    const retire = () => { if (live.get(key) === p) live.delete(key); child.kill(); };
    child.on("error", gone);
    child.on("exit", gone);
    child.stdin.on("error", () => {});
    child.stdout.on("data", chunk => { p.chunks.push(chunk); p.have += chunk.length; settle(p, done, retire); });
    return p;
  };
  port.on("message", ({ key, args, line, batch, close }) => {
    // (each process closed, to be started again when asked: what git read at its start, the objects packed since and the replace objects, is read anew)
    if (close) { for (const other of live.values()) other.child.stdin.end(); live.clear(); return; }
    let p = live.get(key);
    if (!p) { p = start(key, args); live.set(key, p); } else { live.delete(key); live.set(key, p); }
    for (const [k, other] of live) { if (live.size <= OLDEST_KEPT) break; live.delete(k); other.child.stdin.end(); }
    p.batch = batch;
    p.chunks = [];
    p.have = 0;
    p.head = null;
    p.wait = reply => { port.postMessage(reply); Atomics.store(flag, 0, 1); Atomics.notify(flag, 0); };
    p.child.stdin.write(`${line}\n`);
  });
}
// (the answer once the output holds it whole: "<name> missing", or "<object> <kind> <size>" and, for --batch, the body and
// its line's end; the bytes are joined once, when they are all there)
export function settle(p, done, retire) {
  if (!p.head) {
    const all = Buffer.concat(p.chunks), end = all.indexOf(10);
    p.chunks = [all];
    if (end < 0) return;
    const found = /^([0-9a-f]{40,64}) (\w+) (\d+)$/u.exec(all.subarray(0, end).toString("utf8"));
    if (!found) return done({ missing: true });
    const size = Number(found[3]), kind = { oid: found[1], type: found[2], size };
    if (!p.batch) return done(kind);
    if (size > textMax()) { done(kind); return retire(); }
    p.head = { kind, end, size };
  }
  const { kind, end, size } = p.head;
  if (p.have < end + 1 + size + 1) return;
  done({ ...kind, body: new Uint8Array(Buffer.concat(p.chunks).subarray(end + 1, end + 1 + size)) });
}
if (!isMainThread && workerData?.gitObjects) serve(workerData);

// ---- the caller's side ----
let channel = null;
// One question to the worker, answered at once: { missing }, { oid, type, size, body? } or { failed }.
function ask(key, args, line, batch) {
  if (channel === null) {
    try {
      const { port1, port2 } = new MessageChannel(), flag = new Int32Array(new SharedArrayBuffer(4));
      const worker = new Worker(new URL(import.meta.url), { workerData: { gitObjects: true, port: port2, flag }, transferList: [port2], env: SHARE_ENV });
      worker.unref();
      port1.unref();
      channel = { port: port1, flag };
    } catch { channel = false; }
  }
  if (!channel) return { failed: true };
  channel.port.postMessage({ key, args, line, batch });
  // (a worker that does not answer in two minutes is given up, and git is asked one call at a time)
  const waited = Atomics.wait(channel.flag, 0, 0, 120000);
  Atomics.store(channel.flag, 0, 0);
  if (waited === "timed-out") { channel = false; return { failed: true }; }
  return receiveMessageOnPort(channel.port)?.message ?? { failed: true };
}

// The repository's own folder where the root holds it as `.git`, the one place git is asked without walking up from the
// root (a folder git finds above it, a variable naming another, a checkout another user owns, which git's own check of
// ownership refuses to read unless it is told so, and a name past a line are the single call's).
function home(root) {
  const own = path.join(root, ".git");
  let mine = false;
  try { mine = process.platform === "win32" || fs.statSync(own).uid === process.geteuid(); } catch { /* (no .git there) */ }
  return mine && !["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"].some(v => process.env[v] !== undefined) ? own : null;
}
// Close the git processes, so that the next question reads the repository as it stands then (a run reads the commits as they stand when it starts).
export function forget() { if (channel) channel.port.postMessage({ close: true }); }
const plain = name => !/[\r\n\0]/u.test(name);

// What git holds at `rev:at` as `git cat-file --batch-check` says: { oid, type, size }, null where it holds nothing,
// undefined where the batch cannot say, replace objects left unread. `gitDir` is the folder of another repository to ask in.
export function objectAt(root, rev, at, { gitDir = null } = {}) {
  const dir = gitDir ?? home(root);
  if (!dir || !plain(rev) || !plain(at) || /^\.{1,2}(\/|$)/u.test(at)) return undefined;
  const reply = ask(`${dir}\0check`, [`--git-dir=${dir}`, "--no-replace-objects", "cat-file", "--batch-check"], `${rev}:${at}`, false);
  return reply.failed ? undefined : reply.missing ? null : { oid: reply.oid, type: reply.type, size: reply.size };
}

// A file's text at a commit of the repository at `root`, or null where git cannot give it: `git show rev:file`, with
// replace objects read as it reads them.
export function textAt(root, rev, file) {
  const dir = home(root);
  if (!dir || !plain(rev) || !plain(file)) return showAt(root, rev, file);
  let at = file;
  if (/^\.{1,2}(\/|$)/u.test(at)) {
    // (a path git reads from the folder it runs in: the root's, which git holds as the top; one that leaves it is outside the repository, which git refuses)
    at = path.posix.normalize(at);
    if (at === ".." || at.startsWith("../")) return null;
    if (at === "." || at === "./") return showAt(root, rev, file);
  }
  const reply = ask(`${dir}\0text`, [`--git-dir=${dir}`, "cat-file", "--batch"], `${rev}:${at}`, true);
  if ((reply.type && reply.type !== "blob") || (reply.body === undefined && !reply.missing)) return showAt(root, rev, file);
  return reply.missing ? null : Buffer.from(reply.body.buffer, reply.body.byteOffset, reply.body.byteLength).toString("utf8");
}

// Whether `at` is a path `git ls-tree rev -- at` names exactly as written: no empty step, no "." or "..", no magic.
export const exactPath = at => at !== "" && !at.startsWith(":") && plain(at) && at.split("/").every(step => step !== "" && step !== "." && step !== "..");
