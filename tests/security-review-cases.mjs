// The cases the tests of the security-review status against the host's own record share (#626): a merged pull request
// as the host records it, and the host's answers on rights, made here.
import { CORE, OWNER } from "../scripts/core-address.mjs";

export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const HEAD = "a".repeat(40), SEEN = "b".repeat(40), BASE = "c".repeat(40);
export const CODEX = { login: "chatgpt-codex-connector[bot]", type: "Bot" };
export const ME = { login: OWNER, type: "User" };
export const OTHER = { login: "a-stranger", type: "User" };
export const found = { commit_sha: HEAD, has_any_findings: true, has_unresolved_findings: true, status: "completed" };
export const cleared = { ...found, has_unresolved_findings: false };
export const summary = (security, at = "2026-11-12T10:30:00Z") => ({ id: 1, user: CODEX, author_association: "NONE", created_at: "2026-11-12T09:00:00Z", updated_at: at,
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { status: "completed" }, security_review: security })} -->\n| 🔒 **Security Review** | done |` });
export const posted = (sha, at, user = ME, assoc = "OWNER") => ({ id: 2, user, author_association: assoc, created_at: at, updated_at: at, body: `Security review: ${sha}\nBlocking findings: 0.\nOther findings: 0.\nA line of prose.` });
export const finding = (id, at) => ({ id, user: CODEX, author_association: "NONE", created_at: at, updated_at: at, path: "a.js", body: "<!-- codex-security-review-finding:v1 -->\n\n### A finding\n\nIts text." });
export const review = (commit, at, kind = "🛡️ Codex Security Review · _Automatically triggered_") => ({ id: 9, user: CODEX, commit_id: commit, submitted_at: at,
  body: `<!-- codex-review-receipt:v1 -->\n\n\n### ${kind}\n\nHere are some suggestions.\n\n**Reviewed commit:** \`${commit.slice(0, 10)}\`` });
export const commit = { sha: HEAD, parents: [{ sha: BASE }], author: ME, committer: { login: "web-flow", type: "User" }, commit: { verification: { verified: true } } };
// a merged pull request whose Codex security review found one thing on the head, and a review posted after it
export const record = (over = {}) => ({
  pull: { number: 7, state: "closed", draft: false, merged_at: "2026-11-12T12:00:00Z", created_at: "2026-11-12T08:00:00Z", commits: 1, changed_files: 1, user: ME,
    head: { sha: HEAD, repo: { full_name: CORE } }, base: { repo: { full_name: CORE, owner: ME } } },
  comments: [summary(found), posted(HEAD, "2026-11-12T11:00:00Z")], findings: [finding(31, "2026-11-12T10:00:00Z")], commits: [commit],
  files: [{ filename: "scripts/a.mjs", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], reviews: [review(HEAD, "2026-11-12T10:00:00Z")],
  threads: [{ resolved: false, first: 31 }], rights: [], ...over });
export const answer = (login, role, permission = role === "maintain" ? "write" : role, type = "User", push = true) => ({ permission, role_name: role, user: { login, type, permissions: { push } } });
export const listed = (login, role, type = "User") => ({ login, type, role_name: role });
// a host the recorder's test stands in for: each call answered from a table by its route, or refused as gh refuses it
export const refusal = (text) => Object.assign(new Error("gh failed"), { stderr: `${text}\n` });
export const host = (answers) => {
  const calls = [];
  const call = (args) => {
    calls.push(args.join(" "));
    const key = Object.keys(answers).find((route) => args.some((arg) => arg === route || arg.startsWith(`${route}?`) || arg.startsWith(`query=`) && route === "graphql"));
    if (key === undefined) throw refusal(`gh: Not Found (HTTP 404) for ${args.join(" ")}`);
    const given = answers[key];
    if (given instanceof Error) throw given;
    return typeof given === "function" ? given(args) : given;
  };
  return { call, calls };
};
