// Whether a project's repository is private, as its host says it (#1095, point 1): never guessed from the files it
// holds, since a private repository may hold the CodeQL workflow and a public one may lack it, and the kit writes other
// files for each (init.mjs, --private). The repository is the one the clone's origin names on github.com. GitHub's job
// reads it from the event it runs on (GITHUB_EVENT_PATH), where that event's repository is the origin's; a session
// asks gh (`gh api repos/<owner>/<name>`). Where neither answers, it says it could not read it and the mend, and the
// reader that asked decides nothing on it (fresh.mjs, converge.mjs, pure-sync.mjs). A test stands in for the host
// with a file of its answers, each project's root or origin to { "private": true | false }, named by CORE_HOST_ANSWERS, as
// GitHub's event stands for it in a job. Node's own modules, git and gh.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoOf } from "./inbox.mjs";

const gh = route => { const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 24 }); if (r.status !== 0) throw new Error(`${r.stderr || r.error || "no answer"}`.trim()); return r.stdout; };
const said = new Map(); // (one answer a repository a process, so a sync's earlier kits ask the host once)

// { private: true | false } as the host says it of the repository at `root`, or { unread: why, with the mend }.
// `env` and `ask` (a route to its answer's text) are the job's environment and gh, which a test replaces.
export function privateOf(root, { env = process.env, ask = gh } = {}) {
  const origin = spawnSync("git", ["config", "--get", "remote.origin.url"], { cwd: root, encoding: "utf8" }).stdout?.trim() ?? "";
  if (env.CORE_HOST_ANSWERS) {
    const real = at => { try { return fs.realpathSync(at); } catch { return path.resolve(at); } };
    let answers = {};
    try { answers = JSON.parse(fs.readFileSync(env.CORE_HOST_ANSWERS, "utf8")); } catch { /* (none: as no answer) */ }
    // (by the project's root, or by its origin, which each clone of it shares)
    const found = Object.entries(answers).find(([at]) => real(at) === real(root) || (origin && real(at) === real(origin)))?.[1];
    if (typeof found?.private === "boolean") return { private: found.private };
  }
  const repo = repoOf(origin);
  if (!repo) return { unread: "whether the repository is private could not be read: the clone's origin names no repository on github.com. Mend: run it from a clone of the project's repository whose origin is its address on github.com" };
  const key = `${repo}\n${env.GITHUB_EVENT_PATH ?? ""}`;
  if (ask === gh && said.has(key)) return said.get(key);
  let answer = null;
  try {
    const { repository: r } = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    if (String(r?.full_name).toLowerCase() === repo.toLowerCase() && typeof r.private === "boolean") answer = { private: r.private };
  } catch { /* (no event, or another repository's: gh is asked) */ }
  if (!answer) {
    let why = "";
    try { const r = JSON.parse(ask(`repos/${repo}`)); if (typeof r?.private === "boolean") answer = { private: r.private }; } catch (e) { why = ` (${String(e.message).split("\n")[0].slice(0, 120)})`; }
    answer ??= { unread: `whether ${repo} is private could not be read: GitHub gave gh no answer${why}. Mend: sign gh in for an account that can read the repository (\`gh auth login\`), then run it again` };
  }
  if (ask === gh) said.set(key, answer);
  return answer;
}
