// Whether a repository is an account's own all the way back, one reading for every script that asks which projects are
// the owner's own (scripts/state-report.mjs, scripts/trial-draft.mjs). Node alone.

// Whether the repository GitHub answers for as `r` is `account`'s own all the way back: the account owns it, and it is
// no fork, or a fork whose parent and source the account owns too: true or false. Where `r` gives a fork, or a
// repository it does not say is none, no parent or source (as a list's answer does), the repository's own answer,
// `whole(its full name)`, is read, and where that gives none, or one that does not say whether it is a fork or, for a
// fork, whose its parent and source are, null: not read, never read as own or not.
export function ownWhole(account, r, whole) {
  const is = x => typeof x?.owner?.login === "string" && x.owner.login.toLowerCase() === String(account).toLowerCase();
  if (!is(r)) return false;
  if (r.fork === false) return true;
  const full = r.parent || r.source ? r : whole(r.full_name);
  if (full?.fork === false) return true;
  if (full?.fork !== true || !full.parent || !full.source) return null;
  return is(full.parent) && is(full.source);
}
