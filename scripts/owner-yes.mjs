// The owner's yes in a pull request that changes the floor or the review guidelines (floor rule 3, "The owner's yes in
// the PR"; roles/shared/teams.md, "The higher right gives the floor's yeses"; #549), read by the description check
// (pr-description.mjs, beside this file): such a pull request quotes, under its heading "The owner's word", in lines
// that open with ">", words found word for word in the text of an issue it names ("Fixes #n", "Part of #n" and the like),
// in the issue's description or a comment written by an account the host gives its higher right (on GitHub, the role
// `maintain` or `admin`). A quoted line passes where it is found so: whitespace counts as one blank, the issue's own
// ">" marks are read through, and "[…]" (floor rule 11's details left out) splits a line into pieces each found in
// one text. It never guesses: it reads text and the host's answer on each account's right. What it does not read:
// whether the quote covers the change (the design check's), and who last edited a text (the host gives its author).
// It reads only the core's own repository: in a project the floor and the core's review guidelines stand in the
// copy, which a sync alone changes (floor rule 8), so a sync is never asked. gh, git and Node's own modules.
import { spawnSync } from "node:child_process";
import { under } from "./milestones.mjs";

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

// Whether a quoted line stands word for word in one of `texts` (each already readable()): every piece of it between
// "[…]" marks in that one text.
export function found(line, texts) {
  const pieces = String(line).split(/\s*\[(?:…|\.\.\.)\]\s*/u).map(flat).filter(Boolean);
  return pieces.length > 0 && texts.some(t => pieces.every(p => t.includes(p)));
}

// The mend for a pull request, or null where nothing is asked or the yes is found. `paths`: the paths the change asks
// for (asking()); `body`: its description; `texts`: of the issues it names, the texts written by an account with the
// higher right, each readable(); `read`: whether all of it could be read, every account's right among it (false: where
// no quote is found in what was read, the line is said, never failed). Returns { mend } or { note }.
export function yesOf({ paths, body, texts, read = true }) {
  if (!paths.length) return { note: "the owner's yes is not asked here: the change touches neither the floor nor the review guidelines" };
  const lines = quoted(body), issues = issuesOf(body), named = `${paths.slice(0, 3).join(", ")}${paths.length > 3 ? ", …" : ""}`;
  const how = `quote under a heading "## ${WORD}", in lines that open with ">", the owner's words word for word from the issue's text (its description or a comment) written by an account the host gives maintain or admin, details floor rule 11 keeps out written "[…]"`;
  if (!issues.length) return { mend: `this pull request changes ${named}, which asks the owner's yes (floor rule 3), and names no issue. Mend: name the issue that holds the owner's yes ("Fixes #n" or "Part of #n"), and ${how}` };
  if (!lines.length) return { mend: `this pull request changes ${named}, which asks the owner's yes (floor rule 3), and quotes nothing under "${WORD}". Mend: ${how}; where the issue holds no yes for this change, file one asking the owner and leave this pull request unmerged meanwhile` };
  if (lines.some(l => found(l, texts))) return { note: `the owner's yes is quoted, found word for word on ${issues.map(n => `#${n}`).join(", ")}` };
  if (!read) return { note: `the owner's yes could not be checked here: of ${issues.map(n => `#${n}`).join(", ")}, a text or an account's right could not be read; the reviews read it` };
  return { mend: `this pull request changes ${named}, which asks the owner's yes (floor rule 3), and no line it quotes under "${WORD}" stands word for word in the text of ${issues.map(n => `#${n}`).join(", ")} from an account with the higher right. Mend: ${how}; where the issue holds no yes for this change, file one asking the owner and leave this pull request unmerged meanwhile` };
}

// Of the issues `issues` of `repo`, the texts written by an account the host gives the higher right, each readable(),
// through gh: { texts, read }, read false where an issue, a page of its comments or an account's right could not be read
// (the texts read so far are kept, so a quote found among them still passes).
export function textsOf(repo, issues, gh = route => { const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 24 }); return r.status === 0 ? JSON.parse(r.stdout) : null; }) {
  const rights = new Map(), texts = [];
  let read = true;
  // (a login of no account's form, a bot's among them, is no owner; one the host does not answer on is unread)
  const higher = login => {
    if (!/^[A-Za-z0-9-]{1,39}$/u.test(login)) return false;
    if (!rights.has(login)) rights.set(login, gh(`repos/${repo}/collaborators/${login}/permission`)?.role_name ?? null);
    const role = rights.get(login);
    if (role === null) read = false;
    return HIGHER.has(String(role));
  };
  try {
    for (const n of issues) {
      const issue = gh(`repos/${repo}/issues/${n}`);
      if (!issue) return { texts, read: false };
      const notes = [{ login: String(issue.user?.login ?? ""), body: issue.body }];
      for (let page = 1; page <= MOST_PAGES; page++) {
        const one = gh(`repos/${repo}/issues/${n}/comments?per_page=100&page=${page}`);
        if (!Array.isArray(one)) return { texts, read: false };
        notes.push(...one.map(c => ({ login: String(c.user?.login ?? ""), body: c.body })));
        if (one.length < 100) break;
      }
      for (const note of notes) if (higher(note.login)) texts.push(readable(note.body));
    }
  } catch { return { texts, read: false }; }
  return { texts, read };
}
