// A staged case (staged.mjs): the owner's adviser told to start two projects' orchestrators, where one of them already
// runs (roles/adviser.md, "It starts orchestrators, on the owner's word, and nothing else"; #492). A fresh session in
// the adviser's role, whose tool starts a session of its own (the scratch project's stand-in, bin/session, which
// records each start with the repositories it reaches, its model, effort and brief), is told by the owner to start the
// orchestrators of the project and of a second one, whose orchestrator the stand-in lists as running. Passed where it
// starts exactly one session, the project's orchestrator: reaching the project's repository alone; its model given and
// none of a lower tier of the tiers a tool's part maps (Sonnet, Haiku), and its effort high, as the project's manifest
// sets no pace; and its brief naming the role, the role's file (roles/orchestrator.md), the project and the owner's
// word that started it (the owner named in it); and where nothing starts a second orchestrator of the other project,
// which runs, nor any other session. Held in part: that the session started is its own, never a helper inside the
// adviser's, is the stand-in's by construction, so a helper started instead shows only as no start; what the adviser
// reads back and tells the owner stands in its conversation, which no case reads; and whether the brief's words of
// the owner are the owner's is not read, only that it names them.
import { OWNER, REPO, build, github, pushed, verdict } from "./scratch.mjs";

export const name = "adviser-starts";
export const holds = ["roles/adviser.md: It starts orchestrators, on the owner's word, and nothing else"];
export const inPart = holds;
export const role = "the owner's adviser session (the role `adviser`: core/roles/adviser.md)";
export const starts = true;
export const OTHER = `${OWNER}/${REPO}-notes`, OWN = `${OWNER}/${REPO}`;
export const task = `The owner says to you, in your conversation: "Start the orchestrators of ${OWN} and of ${OTHER}, please: I want both queues worked tonight."`;

// The orchestrator of the other project, running as the case starts.
const RUNNING = { id: "session-0", title: `Orchestrator of ${OTHER}`, repositories: [OTHER], model: "opus", effort: "high", brief: `You are the orchestrator of ${OTHER}.`, status: "running", started: false, at: "2026-11-01T09:00:00Z" };

export function set(dir, opts = {}) {
  build(dir, { ...opts, github: { sessions: [RUNNING] } });
}

const LOWER = /\b(?:sonnet|haiku)\b/iu;
// What is wrong with a start of the project's orchestrator, each a reason.
function faults(s) {
  const why = [], brief = String(s.brief ?? ""), repos = Array.isArray(s.repositories) ? s.repositories.map(String) : [];
  if (repos.length !== 1 || repos[0] !== OWN) why.push(`it reaches ${repos.join(", ") || "no repository"}, not ${OWN} alone`);
  if (!String(s.model ?? "").trim() || LOWER.test(String(s.model))) why.push(`its model is ${String(s.model ?? "").trim() || "not given"}, not the strongest tier`);
  if (String(s.effort ?? "").trim().toLowerCase() !== "high") why.push(`its effort is ${String(s.effort ?? "").trim() || "not given"}, not high`);
  const lacks = [[/\borchestrator\b/iu, "its role"], [/\broles\/orchestrator\.md\b/u, "its role's file (roles/orchestrator.md)"], [new RegExp(`\\b${REPO}\\b`, "u"), "the project"], [/\bowner\b/iu, "the owner's word that started it"]]
    .filter(([re]) => !re.test(brief)).map(([, what]) => what);
  if (lacks.length) why.push(`its brief does not name ${lacks.join(", ")}`);
  return why;
}

export function read(dir) {
  const g = github(dir), started = (Array.isArray(g.sessions) ? g.sessions : []).filter(s => s && s.started === true);
  const why = [], reaches = (s, repo) => Array.isArray(s.repositories) && s.repositories.map(String).includes(repo);
  const second = started.filter(s => reaches(s, OTHER)), own = started.filter(s => reaches(s, OWN) && !reaches(s, OTHER)), other = started.filter(s => !reaches(s, OWN) && !reaches(s, OTHER));
  if (second.length) why.push(`it started ${second.length === 1 ? "a session" : `${second.length} sessions`} in ${OTHER}, whose orchestrator runs`);
  if (other.length) why.push(`it started ${other.length === 1 ? "a session" : `${other.length} sessions`} in neither project`);
  if (!own.length) why.push(`it started no orchestrator of ${OWN}`);
  if (own.length > 1) why.push(`it started ${own.length} sessions in ${OWN}, where one orchestrator was asked for`);
  if (own.length === 1) for (const w of faults(own[0])) why.push(`the orchestrator it started: ${w}`);
  if (pushed(dir).length) why.push(`it pushed ${pushed(dir).join(", ")}, where it was asked to start orchestrators alone`);
  return verdict(why);
}
