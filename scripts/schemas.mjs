// The shape of the core's settings files, each held by a schema of its own (scripts/schemas/<name>.json, beside this
// file) and one checker of schemas, ajv, a package the core installs from its lock file (packages.mjs; #530, item 7),
// in place of checks written by hand in each script that reads one. A schema names at each rule the mend its failure
// says ("mend"; for one keyword of a rule, "mendFor"), the nearest along the failing rule's path, {core} standing for
// the copy's folder; each failure says where and what, then "Mend:" and that, as every check of the core does (#254).
// What a schema cannot say (a path that lies outside the project, a file that is not there) stays with the script.
//
//   import { keysOf, shapeFaults } from "./schemas.mjs";   shapeFaults("copies", config, "core/") -> ["the config's ...",
//                                                  ...], [] where it holds; null where ajv is not installed, which the
//                                                  caller says; keysOf("copies") -> the keys its schema gives
import fs from "node:fs";
import { installed, loadSync } from "./packages.mjs";

const schemaOf = name => JSON.parse(fs.readFileSync(new URL(`./schemas/${name}.json`, import.meta.url), "utf8"));
const checkers = new Map();
function checker(name) {
  if (!checkers.has(name)) {
    const Ajv = loadSync("ajv"), ajv = new Ajv({ allErrors: true, strict: true });
    ajv.addKeyword({ keyword: "mend", schemaType: "string" });
    ajv.addKeyword({ keyword: "mendFor", schemaType: "object" });
    const schema = schemaOf(name);
    checkers.set(name, { validate: ajv.compile(schema), schema });
  }
  return checkers.get(name);
}

/** The keys the schema `name` gives its file, read from the schema alone, with no package: for a script that tells its
 *  own file from another's by them. */
export const keysOf = name => Object.keys(schemaOf(name).properties ?? {});

// The mend of a failing rule: the nearest "mendFor" of its keyword, else "mend", up its schema's path.
function mendOf(schema, schemaPath, keyword) {
  let at = schema, found = schema.mendFor?.[keyword] ?? schema.mend;
  const steps = schemaPath.replace(/^#\/?/u, "").split("/").filter(Boolean).slice(0, -1);
  for (const step of steps) {
    at = at?.[step.replace(/~1/gu, "/").replace(/~0/gu, "~")];
    if (at && typeof at === "object") found = at.mendFor?.[keyword] ?? at.mend ?? found;
  }
  return found;
}

// Where a failure lies, in words: the config itself, or the key or item the path names.
const where = path => (path ? `the config's ${path.split("/").slice(1).map(k => (/^\d+$/u.test(k) ? `item ${k}` : JSON.stringify(k.replace(/~1/gu, "/").replace(/~0/gu, "~")))).join(", ")}` : "the config");

/** The failures of `value` against the schema `name`, each with its mend, {core} read as `core`; [] where it holds;
 *  null where ajv is not installed beside the core's copy, which the caller says as a warning. */
export function shapeFaults(name, value, core = "") {
  if (!installed("ajv")) return null;
  const { validate, schema } = checker(name);
  if (validate(value)) return [];
  // (the first SHOWN alone, and a count of the rest: a config of many bad items says each kind once, not a line each)
  const left = validate.errors.length - SHOWN;
  return validate.errors.slice(0, SHOWN).map(e => {
    const extra = e.params?.additionalProperty !== undefined ? ` (${JSON.stringify(e.params.additionalProperty)})` : "";
    return `${where(e.instancePath)} ${e.message}${extra}. Mend: ${String(mendOf(schema, e.schemaPath, e.keyword) ?? "write it as the starter kit does").replaceAll("{core}", core)}`;
  }).concat(left > 0 ? [`the config holds ${left} more faults than those said. Mend: mend those said, then run the check again to see the rest`] : []);
}
const SHOWN = 20;
