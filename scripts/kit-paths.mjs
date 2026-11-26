// The starter kit's words as a project whose checks' configs stand elsewhere would hold them (#1361, point 5), for the
// comparison with a fresh start (fresh.mjs, beside this file): each path of a config the kit writes (KIT_CONFIGS, the
// shape check's and its baseline) read as the path the project runs that check with, so that a config that stands where
// the project's calls name it is no difference in the workflow that calls its check, nor in the text that names it.
// What the one process writes (converge.mjs) stays the kit's own. Node's own modules alone.
import { KIT_CONFIGS } from "./check-configs.mjs";
import { KIT as SHAPE, plainPath, where as shapeAt } from "./shape.mjs";

// Where the kit writes the shape check's baseline.
const SHAPE_BASELINE = "checks/shape-baseline.json";
// A path of a file inside the project, in the form the shape check reads one (no quote, backslash or control
// character can stand in it, so it lands in the kit's JSON and YAML as it is), else null.
const plainFile = s => plainPath(s) && !s.endsWith("/") ? s : null;

// The shape check's baseline in the project `p`, at the path its config names for it where that is a plain path inside
// the project, as the shape check reads it, else where the kit writes it.
export function shapeBaseline(p) {
  let config = null;
  try { config = JSON.parse(p.read(shapeAt(p.manifest)) ?? "null"); } catch { /* (the kit's path, below) */ }
  return plainFile(config?.baseline) ?? SHAPE_BASELINE;
}

// (to, text) => the kit's text of the file `to` with each kit path of a config as the project `p` holds it: `at` the
// paths it runs its checks with (check-configs.mjs, `configs`), the shape check's config and baseline as its manifest
// and that config name them. The NuGet check's config, which the kit names as the licence check's, is the NuGet check's
// own on the lines that pass it (the `config:` of nuget.yml, the `nuget:` of core.yml's one job). A config that cannot
// be read (null), or whose path is not a plain file path inside the project, keeps the kit's path.
export function ownPaths(p, at) {
  const moved = new Map([[KIT_CONFIGS.copies, at.copies], [KIT_CONFIGS.baseline, at.baseline], [KIT_CONFIGS.sizes, at.sizes], [KIT_CONFIGS.licences, at.licences], [KIT_CONFIGS.audit, at.audit], [SHAPE, shapeAt(p.manifest)], [SHAPE_BASELINE, shapeBaseline(p)]].map(([kit, own]) => [kit, plainFile(own)]));
  const kitPath = new RegExp(`(?<![\\w./-])(?:${[...moved.keys()].map(k => k.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})(?![\\w/-])`, "gu");
  return (to, text) => text.split("\n").map(line => {
    const nuget = (to === ".github/workflows/nuget.yml" && /^\s*config:/u.test(line)) || /^\s*nuget:/u.test(line);
    return line.replace(kitPath, kit => (nuget && kit === KIT_CONFIGS.licences ? plainFile(at.nuget) : moved.get(kit)) ?? kit);
  }).join("\n");
}
