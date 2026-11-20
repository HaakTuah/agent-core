// A change to the floor or the review guidelines that keeps the meaning asks no yes of the owner (floor rule 3;
// roles/shared/review-guidelines.md, "A change that keeps the meaning is stated so"; #886, point 2). Two readers:
//   - stated: for the description check (pr-description.mjs, beside this file), of the files that ask the yes and that
//     path-only.mjs does not prove, those the design check states keep their meaning. Of the pull request's comments
//     written by an account the host gives its higher right and edited, where at all, by such accounts alone
//     (owner-yes.mjs's countedOf; never its description, which its builder writes), the newest that opens
//     "Design check:" decides: a path it names on a line of its own "Meaning unchanged:" is stated where the commit its
//     first line names by its whole SHA holds that file as the same blob as the pull request's head. It states nothing
//     where the pull request changes a file that decides the check (path-only.mjs's read: the description check, what
//     it imports, its workflow and what that sets up), so the code that reads the statement is `main`'s. What it does
//     not read: whether the meaning is kept, and who wrote the comment, since builder and reviewer post under one login
//     (tasks/reviews.md, point 3): the reviewer's word and the state report's list hold those.
//   - withoutYes: for the core's monthly state report (look.mjs, beside this file), the pull requests merged in a month
//     that changed a file that asks the yes and quote nothing under "The owner's word", so the owner can look them over.
// It never guesses: what it cannot read states nothing, and the yes is asked. gh, git and Node's own modules.
import { spawnSync } from "node:child_process";
import { mergedIn } from "./cited.mjs";
import { asks, countedOf, quoted } from "./owner-yes.mjs";
import { read } from "./path-only.mjs";

export const LINE = "Meaning unchanged:";
const DESIGN = /^Design check:[ \t]*([0-9a-f]{40})(?![0-9a-f])/u;

// The paths a comment states keep their meaning, on lines of their own that open LINE: split at commas or blanks, each
// taken out of backticks, a closing "." dropped.
export function pathsOf(body) {
  const lines = String(body ?? "").split(/\r\n|\r|\n/u).filter(l => l.trimStart().startsWith(LINE));
  return lines.flatMap(l => l.trimStart().slice(LINE.length).split(/[,\s]+/u)).map(p => p.replace(/^`+|[`.]+$/gu, "")).filter(Boolean);
}

// Of `asked` (paths that ask the yes), those the newest design check among `notes` (countedOf's, in the host's order)
// states keep their meaning, where `blob(sha, path)` and `blob(null, path)` (the head's) give the same blob, neither null.
export function stated({ notes, asked, blob }) {
  const design = [...notes].reverse().find(n => n.comment && DESIGN.test(String(n.body).trimStart()));
  if (!design) return [];
  const sha = String(design.body).trimStart().match(DESIGN)[1], named = new Set(pathsOf(design.body));
  return asked.filter(p => { if (!named.has(p)) return false; const at = blob(sha, p), head = blob(null, p); return at !== null && at === head; });
}

const ghJson = route => { const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 24 }); try { return r.status === 0 ? JSON.parse(r.stdout) : null; } catch { return null; } };
const git = (cwd, args) => { const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 26 }); return r.status === 0 ? r.stdout : null; };

// The paths of `asked` the design check of pull request `number` of `repo` states keep their meaning, in `cwd` with the
// merge commit checked out (HEAD^1 the base, HEAD^2 the head): [] where anything cannot be read.
export function statedOf({ cwd, repo, number, asked, gh = ghJson }) {
  if (!asked.length || !/^\d{1,7}$/u.test(String(number)) || !/^[\w.-]+\/[\w.-]+$/u.test(repo)) return [];
  const change = read(cwd, "HEAD^1", "HEAD");
  if (change === null || change.self) return [];
  const { notes } = countedOf(repo, [Number(number)], gh);
  const blob = (sha, p) => {
    if (sha === null) return git(cwd, ["rev-parse", "--verify", "--quiet", `HEAD^2:${p}`])?.trim() || null;
    const got = gh(`repos/${repo}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`);
    return typeof got?.sha === "string" && got.type === "file" ? got.sha : null;
  };
  return stated({ notes, asked, blob });
}

// The pull request's number in the run of a pull request's event (GITHUB_REF refs/pull/<n>/merge), or null.
export const numberOf = ref => String(ref ?? "").match(/^refs\/pull\/(\d{1,7})\/merge$/u)?.[1] ?? null;

// Of `pulls` merged ({ number, title, body, files }), those whose files ask the yes and whose description quotes
// nothing under "The owner's word": the lines of the state report, null where `pulls` could not be read.
export function withoutYes(pulls) {
  if (pulls === null) return null;
  const found = pulls.filter(p => p.files !== null && p.files.some(asks) && quoted(p.body).length === 0);
  const unread = pulls.filter(p => p.files === null).length;
  return [
    ...(found.length ? found.map(p => `- #${p.number} ${p.title}: ${p.files.filter(asks).join(", ")}.`) : ["- None."]),
    ...(unread ? [`- Not read: the files of ${unread} merged pull request${unread === 1 ? "" : "s"}, which git here could not give.`] : []),
  ];
}

// The pull requests of `repo` merged in `month` ("YYYY-MM") with the files each merge changed against its base, read
// from git in `cwd` (the look's checkout holds the whole history), null where they could not be listed.
export function mergedFiles({ repo, from, to, cwd = process.cwd(), list = mergedIn }) {
  try {
    return list(repo, from, to).map(p => {
      const sha = /^[0-9a-f]{40}$/u.test(String(p.merge_commit_sha)) ? p.merge_commit_sha : null;
      const out = sha === null ? null : git(cwd, ["diff", "--name-only", "--no-renames", "-z", `${sha}^1`, sha]);
      return { number: p.number, title: p.title, body: p.body ?? "", files: out === null ? null : out.split("\0").filter(Boolean) };
    });
  } catch { return null; }
}
