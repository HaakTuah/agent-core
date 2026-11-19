// The owner's yes in a pull request that changes the floor or the review guidelines (floor rule 3, "The owner's yes in
// the PR"; roles/shared/teams.md, "The higher right gives the floor's yeses"; #549), read by the description check
// (pr-description.mjs, beside this file): such a pull request quotes, under its heading "The owner's word", in lines
// that open with ">", words found word for word in the text of an issue it names ("Fixes #n", "Part of #n" and the like),
// in the issue's description or a comment written by an account the host gives its higher right (on GitHub, the role
// `maintain` or `admin`, of an account whose type is User: tasks/github-calls.md). A quoted line passes where it is found so: whitespace counts as one blank, the issue's own
// ">" marks are read through, and "[…]" (floor rule 11's details left out) splits a line into pieces each found in
// one text. It never guesses: it reads text and the host's answer on each account's right. What it does not read:
// whether the quote covers the change (the design check's). A text that was edited counts only where every account the
// host names among its editors has the higher right too, since one who may only write can edit another's text.
// It reads only the core's own repository: in a project the floor and the core's review guidelines stand in the
// copy, which a sync alone changes (floor rule 8), so a sync is never asked. gh, git and Node's own modules.
import { spawnSync } from "node:child_process";
import { under } from "./milestones.mjs";
import { pathIn } from "./reading.mjs";

export const WORD = "The owner's word";
// The paths that ask for the yes, relative to the core's root.
export const asks = p => p.startsWith("floor/") || p === "roles/shared/review-guidelines.md";
// The roles the host gives that count as the higher right.
export const HIGHER = new Set(["admin", "maintain"]);
// The most issues and comment pages read for one pull request, so a description cannot make a run long.
export const MOST_ISSUES = 3, MOST_PAGES = 3;

const flat = text => String(text ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
// An issue's text as quotes are read in it: each line's ">" marks taken off, blanks as one.
export const readable = text => flat(String(text ?? "").split(/\r\n|\r|\n/u).map(l => l.replace(/^\s{0,3}(?:>\s?)+/u, "")).join("\n"));

// Where the core lies on the base (the merge's first parent, HEAD^1), as the base's manifest says, so that a pull request
// cannot steer it by the manifest it brings: "" where the base holds no core-manifest.md (the core's own repository),
// the manifest's path where it does, null where git cannot say.
export function coreAtBase(dir, git = args => spawnSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 24 })) {
  const tree = git(["ls-tree", "--name-only", "HEAD^1", "--", "core-manifest.md"]);
  if (tree.status !== 0) return null;
  if (tree.stdout.trim() === "") return "";
  const manifest = git(["show", "HEAD^1:core-manifest.md"]);
  return manifest.status === 0 ? pathIn(manifest.stdout) : null;
}

// The paths of the change that ask for the yes: none where the change is not the core's own (`prefix` "" is the core's
// root; a project's copy stands under another).
export const asking = (paths, prefix) => (prefix === "" ? (paths ?? []).filter(asks) : []);

// The issues a description names as its own: "Fixes #n", "Closes #n", "Resolves #n" (each form of the word) and "Part
// of #n", at most MOST_ISSUES, each once.
export function issuesOf(body) {
  const found = [...String(body ?? "").matchAll(/\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?|part of)\s+#(\d{1,7})\b/giu)].map(m => Number(m[1]));
  return [...new Set(found)].slice(0, MOST_ISSUES);
}

// The lines quoted under the heading WORD: each line that opens with ">", its marks taken off, blanks as one.
export function quoted(body) {
  const part = under(body, WORD);
  if (part === null) return [];
  return part.split("\n").filter(l => /^\s{0,3}>/u.test(l)).map(l => flat(l.replace(/^\s{0,3}(?:>\s?)+/u, ""))).filter(Boolean);
}

// The fewest words a quoted line holds, its pieces together, so that a letter or two found in any text is no yes.
export const WORDS = 3;
const WORDY = /[\p{L}\p{N}]/u;
const words = piece => piece.split(" ").filter(w => WORDY.test(w)).length;
// Whether `piece` stands in `text` as whole words: no letter or digit runs on into it at either end.
const whole = (text, piece) => {
  for (let at = text.indexOf(piece); at !== -1; at = text.indexOf(piece, at + 1)) {
    const runs = (outside, inside) => outside !== undefined && WORDY.test(outside) && WORDY.test(inside);
    if (!runs(text[at - 1], piece[0]) && !runs(text[at + piece.length], piece.at(-1))) return true;
  }
  return false;
};
// Whether a quoted line stands word for word in one of `texts` (each already readable()): every piece of it between
// "[…]" marks in that one text, as whole words, the pieces holding WORDS words or more together.
export function found(line, texts) {
  const pieces = String(line).split(/\s*\[(?:…|\.\.\.)\]\s*/u).map(flat).filter(Boolean);
  return pieces.reduce((n, p) => n + words(p), 0) >= WORDS && texts.some(t => pieces.every(p => whole(t, p)));
}

// The mend for a pull request, or null where nothing is asked or the yes is found. `paths`: the paths the change asks
// for (asking()); `body`: its description; `texts`: of the issues it names, the texts written by an account with the
// higher right, each readable(); `read`: whether all of it could be read, every account's right among it (false: where
// no quote is found in what was read, the line is said, never failed). Returns { mend } or { note }.
export function yesOf({ paths, body, texts, read = true }) {
  if (!paths.length) return { note: "the owner's yes is not asked here: the change touches neither the floor nor the review guidelines" };
  const lines = quoted(body), issues = issuesOf(body), named = `${paths.slice(0, 3).join(", ")}${paths.length > 3 ? ", …" : ""}`;
  const how = `quote under a heading "## ${WORD}", in lines that open with ">", the owner's words word for word from the issue's text (its description or a comment) written by an account the host gives maintain or admin, whole words, ${WORDS} or more to a line, details floor rule 11 keeps out written "[…]"`;
  if (!issues.length) return { mend: `this pull request changes ${named}, which asks the owner's yes (floor rule 3), and names no issue. Mend: name the issue that holds the owner's yes ("Fixes #n" or "Part of #n"), and ${how}` };
  if (!lines.length) return { mend: `this pull request changes ${named}, which asks the owner's yes (floor rule 3), and quotes nothing under "${WORD}". Mend: ${how}; where the issue holds no yes for this change, file one asking the owner and leave this pull request unmerged meanwhile` };
  if (lines.some(l => found(l, texts))) return { note: `the owner's yes is quoted, found word for word on ${issues.map(n => `#${n}`).join(", ")}` };
  if (!read) return { note: `the owner's yes could not be checked here: of ${issues.map(n => `#${n}`).join(", ")}, a text or an account's right could not be read; the reviews read it` };
  return { mend: `this pull request changes ${named}, which asks the owner's yes (floor rule 3), and no line it quotes under "${WORD}" stands word for word in the text of ${issues.map(n => `#${n}`).join(", ")} from an account with the higher right. Mend: ${how}; where the issue holds no yes for this change, file one asking the owner and leave this pull request unmerged meanwhile` };
}

// The query of GraphQL that gives, for each of `ids` (the host's node ids of issues and comments, at most BATCH, which
// the host refuses past), whether it was edited and by whom: the host gives every editor, the first 100 of them.
export const editsQuery = ids => `query { nodes(ids: [${ids.map(id => JSON.stringify(id)).join(", ")}]) { id ... on UserContentEditable { lastEditedAt userContentEdits(first: 100) { totalCount nodes { editor { login } } } } } }`;
const NODE = /^[A-Za-z0-9_=-]{1,100}$/u, BATCH = 100;
const ghCall = (route, query) => { const r = spawnSync("gh", query === undefined ? ["api", route] : ["api", "graphql", "-f", `query=${query}`], { encoding: "utf8", maxBuffer: 1 << 24 }); return r.status === 0 ? JSON.parse(r.stdout) : null; };

// The texts of the issues `issues` of `repo`, through gh: { notes: [{ login, body, id }], read }, read false where an
// issue or a page of its comments was not given, or the comments ran past MOST_PAGES.
function notesOf(repo, issues, gh) {
  const notes = [];
  let read = true;
  for (const n of issues) {
    const issue = gh(`repos/${repo}/issues/${n}`);
    if (!issue) { read = false; continue; }
    notes.push({ login: String(issue.user?.login ?? ""), body: issue.body, id: issue.node_id });
    for (let page = 1; page <= MOST_PAGES; page++) {
      const one = gh(`repos/${repo}/issues/${n}/comments?per_page=100&page=${page}`);
      if (!Array.isArray(one)) { read = false; break; }
      notes.push(...one.map(c => ({ login: String(c.user?.login ?? ""), body: c.body, id: c.node_id })));
      // (a last page still full: comments past it were not read)
      if (one.length === 100 && page === MOST_PAGES) read = false;
      if (one.length < 100) break;
    }
  }
  return { notes, read };
}

// The host's answer on the edits of each of `ids`, in batches of BATCH: a Map of id to its node, those it gives.
function editsOf(ids, gh) {
  const by = new Map();
  for (let at = 0; at < ids.length; at += BATCH) {
    const nodes = gh("graphql", editsQuery(ids.slice(at, at + BATCH)))?.data?.nodes;
    for (const node of Array.isArray(nodes) ? nodes : []) if (typeof node?.id === "string") by.set(node.id, node);
  }
  return by;
}

// Whether a text by an account of the higher right counts, from its node (editsOf): "yes" where it was never edited or
// every editor has the higher right too (`higher`), "no" where one has not, "unread" where the host does not say.
function counts(node, higher) {
  if (node === undefined) return "unread";
  if (node.lastEditedAt === null) return "yes";
  const edits = node.userContentEdits;
  if (!Array.isArray(edits?.nodes) || edits.nodes.length === 0 || edits.totalCount !== edits.nodes.length) return "unread";
  return edits.nodes.every(edit => higher(String(edit?.editor?.login ?? ""))) ? "yes" : "no";
}

// Of the issues `issues` of `repo`, the texts written by an account the host gives the higher right, and edited, where
// at all, by such accounts alone, each readable(), through gh (a REST route, or "graphql" with its query): { texts, read },
// read false where an issue, a page of its comments, an account's right or a text's editors could not be read, or the
// comments ran past MOST_PAGES (the texts read so far are kept, so a quote found among them still passes).
export function textsOf(repo, issues, gh = ghCall) {
  const rights = new Map();
  let read = true;
  // (a login of no account's form, a bot's among them, is no owner; one the host does not answer on is unread)
  const higher = login => {
    if (!/^[A-Za-z0-9-]{1,39}$/u.test(login)) return false;
    if (!rights.has(login)) { const got = gh(`repos/${repo}/collaborators/${login}/permission`); rights.set(login, got?.role_name ? got : null); }
    const right = rights.get(login);
    if (right === null) read = false;
    return HIGHER.has(String(right?.role_name)) && right?.user?.type === "User";
  };
  try {
    const got = notesOf(repo, issues, gh), kept = got.notes.filter(note => higher(note.login));
    if (!got.read) read = false;
    // (a kept text whose id is of no node's form, or whose editors the host does not give, is unread)
    const by = editsOf(kept.map(note => note.id).filter(id => typeof id === "string" && NODE.test(id)), gh);
    const verdicts = kept.map(note => [note, counts(by.get(note.id), higher)]);
    if (verdicts.some(([, v]) => v === "unread")) read = false;
    return { texts: verdicts.filter(([, v]) => v === "yes").map(([note]) => readable(note.body)), read };
  } catch { return { texts: [], read: false }; }
}
