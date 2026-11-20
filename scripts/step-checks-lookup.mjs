// What a job runs before the package steps: the lookup's, the install's and the parser's, with nothing of the pull
// request's before them (steps.mjs, beside this file, holds the steps, and step-checks.mjs the words they share). Each
// piece takes the project as steps.mjs's `project` reads it and returns the mend, or null where the step is done; a
// step names the ones it needs, none runs by itself. It reads only. Node's own modules and git only.
import path from "node:path";
import { copyAt } from "./check-configs.mjs";
import { shown } from "./step-checks.mjs";
import { jobsOf } from "./step-checks-jobs.mjs";

// Where a job of the project's own workflows runs a script of the copy before the core's packages are installed from its
// lock file (#654): each such workflow, with the mend; null where each installs first. A call to the core's own
// workflows installs by itself, and holds no step to read. The install counts only as a step that runs it, node and the
// copy's install.mjs as a command's first words (after a shell's then, else or do), with no `if:` or
// continue-on-error of its own; a command that only names the path, as echo does, installs nothing.
// (the reading both install steps share: the copy's scripts and install; whether a step runs a file, a command as
// check-configs.mjs reads it, its words; and whether it installs, naming one of `named` where it is given)
function installReading(p) {
  const copy = copyAt(p), script = `${copy}scripts/`, install = `${copy}scripts/install.mjs`;
  const bare = t => t.replace(/^\.\//u, "");
  const runs = (st, file) => st.cmds.some(c => c.some(w => file(bare(w.text))));
  const installs = (st, named) => st.unconditioned && st.cmds.some(c => {
    const w = c.map(x => x.text); while (["then", "else", "do"].includes(w[0])) w.shift();
    return /(?:^|[\\/])node(?:\.exe)?$/u.test(w[0] ?? "") && bare(w[1] ?? "") === install && (!named || w.slice(2).some(a => named.includes(a)));
  });
  return { script, install, bare, runs, installs };
}

export function installsFirst(p) {
  const { script, install, runs, installs } = installReading(p);
  const wrong = Object.entries(p.workflows).filter(([, w]) => jobsOf(w).some(job => {
    const at = job.steps.findIndex(st => runs(st, t => t.startsWith(script) && t.endsWith(".mjs") && t !== install));
    return at >= 0 && !job.steps.slice(0, at).some(st => installs(st));
  })).map(([f]) => `\`.github/workflows/${shown(f)}\``);
  return wrong.length ? `In one small pull request, add a step \`node ${install}\` before the first step that runs a .mjs script under \`${script}\` in each such job of ${wrong.join(", ")}: the core's scripts load the packages it installs from its lock file, and without them a check says it did not run.` : null;
}

// Where a job of the project's own workflows runs the shape check (its script, or the copies check's steps through
// checks.mjs) or the selection of tests, which reads through the shape check's readers (select.mjs; #530, item 6),
// before the parser's packages are installed from their own lock file (#719): each such workflow, with the mend; null
// where each names that install first. Read as installsFirst reads an install, and naming `parser` or `all`.
export function parserFirst(p) {
  const { script, install, bare, installs } = installReading(p);
  const shapes = st => st.cmds.some(c => { const w = c.map(x => bare(x.text)); return w.includes(`${script}shape.mjs`) || w.includes(`${script}select.mjs`) || (w.includes(`${script}checks.mjs`) && w.includes("copies")); });
  const wrong = Object.entries(p.workflows).filter(([, w]) => jobsOf(w).some(job => {
    const at = job.steps.findIndex(shapes);
    return at >= 0 && !job.steps.slice(0, at).some(st => installs(st, ["parser", "all"]));
  })).map(([f]) => `\`.github/workflows/${shown(f)}\``);
  return wrong.length ? `In one small pull request, have the step that installs the core's packages in each job of ${wrong.join(", ")} that runs the shape check or the selection of tests install the parser's too, \`node ${install} all\`, before either runs: they read the functions of JavaScript, TypeScript, C# and Python, and all of C# and Python, on the parser, whose packages stand in a lock file of their own, and without them, after an install of the core's first lock alone, the shape check reads none of that, saying so as a warning, the selection runs each test of C# or Python as one that reaches every file, and with no install of the core's at all either fails, saying so.` : null;
}

// A config as a step names it, from the folder the step runs in, so that one name in two folders is two configs.
export const placed = (cfg, dir) => (typeof cfg === "string" && dir && !path.posix.isAbsolute(cfg) ? path.posix.normalize(path.posix.join(dir, cfg)) : cfg);

// Whether a counted lookup step runs the lookup, given `flag`, with the config `at.cfg` the check's step gives; a config
// named by a variable is matched only where both steps give that variable the same value (or neither sets it), one
// an action's input names, where its caller gave none, is matched by none, and a lookup counts only where it is a step
// that may stand before the lookup itself (beforeLookup: the runner's node running the copy's own script from the
// project's root, nothing hidden), and every step before it in its job is one too, so nothing the pull request holds
// has run before it.
export const lookupOf = (st, flag, copy, at, job) => {
  if (/\$\{\{\s*inputs\./u.test(at.cfg ?? "") || !beforeLookup(st, copy)) return false;
  const i = job.steps.indexOf(st);
  if (i < 0 || !job.steps.slice(0, i).every(x => beforeLookup(x, copy))) return false;
  if (!st.counts || !looksUp(st.cmds[0], flag, copy) || placed(configOf(st.cmds[0], "lookup.mjs", copy), st.dir) !== at.cfg) return false;
  const name = /\$\{?(\w+)|%(\w+)%/u.exec(at.cfg ?? "");
  return !name || st.env[name[1] ?? name[2]] === at.step.env[name[1] ?? name[2]];
};

// Where a lookup stands, as the step's mend says it (beforeLookup).
export const FIRST = copy => `with nothing before it in its job but the checkout, \`setup-\` actions and the core's lookup, exact-versions, licence, agent-tools and install scripts, each run as \`node ${copy}scripts/<name>.mjs\` from the project's root under bash (named, or on GitHub's own Linux or macOS runner) in a job with no container or services, with no env but a variable its config is named by, each setup action given only its version, its cache, if named, turned off (\`package-manager-cache: false\`, or in \`setup-dotnet\` \`cache: false\`), so that nothing of the pull request's (\`npm\`, \`dotnet\`, a build script, a local action, \`${copy}scripts/nuget.mjs\`) has run before it`;

// Whether a step may stand before a lookup: checkout or a setup action, or a run, by the runner's own `node`, from the
// project's root, of one of the core's scripts that only read (BEFORE_LOOKUP), named by the copy's own path, with nothing
// hidden (hides). Anything else (dotnet under any spelling, npm, a build script, make, a local action, a script of the
// core's that restores or runs the project's tests) may run the pull request's own files, which could change what the
// lookup reads or the lookup itself: an allow-list, not a search for a build.
// (and the install of the core's own packages from its lock file, which runs none of their code: #654)
const BEFORE_LOOKUP = ["lookup.mjs", "exact-versions.mjs", "licences.mjs", "agent-tools.mjs", "install.mjs"];

const beforeLookup = (st, copy) => (st.uses ? st.plain && /^actions\/(?:checkout|setup-[\w-]+)@/u.test(st.uses)
  : !st.hidden && (st.dir === undefined || st.dir === ".") && st.cmds.length > 0 && st.cmds.every(c => c.length > 1
    && /^node(?:\.exe)?$/iu.test(c[0].text) && BEFORE_LOOKUP.some(n => c[1].text === `${copy}scripts/${n}` || c[1].text === `./${copy}scripts/${n}`)));

// Whether a command names the script `name` of the copy at `copy` (the manifest's path, core/ by default), and, given
// `flag`, with that flag (true) or without it (false).
export const running = (words, name, flag, copy = "core/") => words.some(w => new RegExp(`(?:^|/)${copy.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")}scripts/${name.replace(".", "\\.")}$`, "u").test(w.text))
  && (flag === undefined || words.some(w => w.text === "--nuget") === flag);

// The config a command gives the copy's script `name`: its first argument after the script that is no flag.
export const configOf = (words, name, copy) => {
  const at = words.findIndex(w => running([w], name, undefined, copy));
  return at < 0 ? null : words.slice(at + 1).find(w => !w.text.startsWith("--"))?.text ?? null;
};

// Whether a command runs the lookup itself: node, then the copy's script.
export const looksUp = (words, flag, copy) => /(?:^|[\\/])node(?:\.exe)?$/iu.test(words[0]?.text ?? "") && words.length > 1 && running([words[1]], "lookup.mjs", undefined, copy) && running(words, "lookup.mjs", flag, copy);
