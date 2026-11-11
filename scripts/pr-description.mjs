// The description check ("Each PR says what the owner can try" in modules/git.md; "Readings taken" in
// modules/how-to-work.md), for every project that takes the core, on every PR that is not a draft: it fails a
// description without a heading for each part the project names, by default "What the owner can try" and "Readings
// taken". A part is there when a line of the description is a heading (one to six #) that starts with its words,
// whatever case and whatever follows them: "### Readings taken (the unsure first)" counts. Where nothing was open, the
// heading stands with "None" under it, so the check never guesses whether something was. It holds that the parts are
// there, not that they are true or whole: that stays with the reviews. Dependabot's own PRs are not asked (the workflow
// leaves them out by their author). Reads only: the description comes in PR_BODY, never on the command line; Node's own
// modules. Run by the description workflow (.github/workflows/pr-description.yml).
//
//   PR_BODY="$(...)" node core/scripts/pr-description.mjs ["Part one|Part two"]
import { pathToFileURL } from "node:url";

export const PARTS = ["What the owner can try", "Readings taken"];

// The parts, of those asked for, that the description has no heading for.
export function missing(body, parts = PARTS) {
  const headings = String(body ?? "").split(/\r\n|\r|\n/u).map(line => /^ {0,3}#{1,6}[ \t]+(.*)$/u.exec(line)?.[1].trim().toLowerCase()).filter(Boolean);
  return parts.filter(part => !headings.some(h => h === part.toLowerCase() || h.startsWith(part.toLowerCase()) && /^[^\p{L}\p{N}]/u.test(h.slice(part.length))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const parts = (process.argv[2] ?? "").split("|").map(p => p.trim()).filter(Boolean);
  const absent = missing(process.env.PR_BODY, parts.length ? parts : PARTS);
  for (const part of absent) console.log(`FAIL the description has no heading "${part}": add "## ${part}" with what belongs under it ("None" where there is nothing)`);
  console.log(`${absent.length ? "FAIL" : "ok  "} the description's parts: ${absent.length} of ${(parts.length ? parts : PARTS).length} missing`);
  process.exit(absent.length ? 1 : 0);
}
