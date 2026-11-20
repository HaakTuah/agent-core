// What git holds at a commit, read through one long-lived `git cat-file --batch` (and `--batch-check`) a repository,
// never a git process a file (#732): the agent-tools check asks for a few thousand objects a run, which on Windows cost a
// process each. Node's own modules and git only.
//
// The reader is synchronous, as the check is: a worker thread owns the git processes and the caller waits on it
// (Atomics.wait), so nothing here is a promise. Wherever the batch cannot answer exactly as the single call did (a path
// that holds a line's end, one git reads relative to a folder, a repository found by walking up from the root, git's own
// variables set, an object that is no file, a worker or a process that fails) the single call is made, so no answer
// differs from what it was.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MessageChannel, SHARE_ENV, Worker, isMainThread, receiveMessageOnPort, workerData } from "node:worker_threads";
import { textAt as showAt } from "./licences.mjs";

const OLDEST_KEPT = 4; // (the processes kept at once; the one asked least recently is closed)
const TEXT_MAX = 1 << 28; // (the bound `git show` was read to: a larger file is as good as unread)

// ---- the worker: one process for each repository and way of asking, a line in and its answer out ----
function serve({ port, flag }) {
  const live = new Map();
  const start = (key, args) => {
    const child = spawn("git", args, { stdio: ["pipe", "pipe", "ignore"] }), p = { child, chunks: [], wait: null };
    const done = reply => { const w = p.wait; p.wait = null; if (w) w(reply); };
    const gone = () => { live.delete(key); done({ failed: true }); };
    child.on("error", gone);
    child.on("exit", gone);
    child.stdin.on("error", () => {});
    child.stdout.on("data", chunk => { p.chunks.push(chunk); settle(p, done); });
    return p;
  };
  port.on("message", ({ key, args, line, batch }) => {
    let p = live.get(key);
    if (!p) { p = start(key, args); live.set(key, p); } else { live.delete(key); live.set(key, p); }
    for (const [k, other] of live) { if (live.size <= OLDEST_KEPT) break; live.delete(k); other.child.stdin.end(); }
    p.batch = batch;
    p.chunks = [];
    p.wait = reply => { port.postMessage(reply); Atomics.store(flag, 0, 1); Atomics.notify(flag, 0); };
    p.child.stdin.write(`${line}\n`);
  });
}
// (the answer once the output holds it whole: "<name> missing", or "<object> <kind> <size>" and, for --batch, the body)
function settle(p, done) {
  const all = Buffer.concat(p.chunks);
  p.chunks = [all];
  const end = all.indexOf(10);
  if (end < 0) return;
  const head = all.subarray(0, end).toString("utf8"), found = /^([0-9a-f]{40,64}) (\w+) (\d+)$/u.exec(head);
  const send = reply => { p.chunks = []; done(reply); };
  if (!found) return send({ missing: true });
  const size = Number(found[3]), kind = { oid: found[1], type: found[2], size };
  if (!p.batch || size > TEXT_MAX) return send(kind);
  if (all.length < end + 1 + size + 1) return;
  send({ ...kind, body: all.subarray(end + 1, end + 1 + size).slice() });
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
// root (a folder git finds above it, a variable naming another, and a name past a line are the single call's).
function home(root) {
  const own = path.join(root, ".git");
  return fs.existsSync(own) && !["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"].some(v => process.env[v] !== undefined) ? own : null;
}
const plain = name => !/[\r\n\0]/u.test(name);

// What git holds at `rev:at` as `git cat-file --batch-check` says: { oid, type, size }, null where it holds nothing,
// undefined where the batch cannot say. `gitDir` is the folder of another repository to ask in, `replace` whether git's
// replace objects are read.
export function objectAt(root, rev, at, { gitDir = null, replace = false } = {}) {
  const dir = gitDir ?? home(root);
  if (!dir || !plain(rev) || !plain(at) || /^\.{1,2}(\/|$)/u.test(at)) return undefined;
  const reply = ask(`${dir}\0${replace}\0check`, [`--git-dir=${dir}`, ...(replace ? [] : ["--no-replace-objects"]), "cat-file", "--batch-check"], `${rev}:${at}`, false);
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
  const reply = ask(`${dir}\0true\0text`, [`--git-dir=${dir}`, "cat-file", "--batch"], `${rev}:${at}`, true);
  if ((reply.type && reply.type !== "blob") || (reply.body === undefined && !reply.missing)) return showAt(root, rev, file);
  return reply.missing ? null : Buffer.from(reply.body.buffer, reply.body.byteOffset, reply.body.byteLength).toString("utf8");
}

// Whether `at` is a path `git ls-tree rev -- at` names exactly as written: no empty step, no "." or "..", no magic.
export const exactPath = at => at !== "" && !at.startsWith(":") && plain(at) && at.split("/").every(step => step !== "" && step !== "." && step !== "..");
