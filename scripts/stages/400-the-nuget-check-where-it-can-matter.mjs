// The stage of scripts/steps/400-the-nuget-check-where-it-can-matter.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { at, read, write, folds, NUGET } from "../stage-helpers.mjs";

export default {
  // (a project file that imports a build file of another name than those the call's paths name)
  // (on a call of its own to the core's nuget.yml: where core.yml's one job ran the check, it is moved to that call, #376)
  stage: dir => {
    if (folds(dir, "nuget")) write(dir, ".github/workflows/core.yml", read(dir, ".github/workflows/core.yml").replace(/^ {6}nuget: .*\r?\n/m, ""));
    const call = fs.existsSync(at(dir, ".github/workflows/nuget.yml")) ? read(dir, ".github/workflows/nuget.yml") : NUGET;
    write(dir, ".github/workflows/nuget.yml", /^ {4}paths:/m.test(call) ? call : call.replace(/^ {2}pull_request:\r?\n/m, on => `${on}${read(fileURLToPath(new URL("../..", import.meta.url)), "setup/template/workflows/nuget-paths.yml.tmpl")}`));
    write(dir, "staged-import/Imports.csproj", '<Project Sdk="Microsoft.NET.Sdk">\n  <Import Project="deps.xml" />\n</Project>\n');
    write(dir, "staged-import/deps.xml", "<Project>\n</Project>\n");
    write(dir, "staged-import/packages.lock.json", "{\n  \"version\": 1,\n  \"dependencies\": {}\n}\n");
    const config = JSON.parse(read(dir, "checks/licences.json"));
    config.nuget ??= { ships: [], tools: [] };
    config.nuget.ships = [...(config.nuget.ships ?? []), "staged-import/packages.lock.json"];
    write(dir, "checks/licences.json", `${JSON.stringify(config, null, 2)}\n`);
  },
  // (as the step words it: the file added to the paths, by its exact path)
  mend: dir => write(dir, ".github/workflows/nuget.yml", read(dir, ".github/workflows/nuget.yml").replace(/^( {4}paths:\r?\n)/m, "$1      - 'staged-import/deps.xml'\n")),
};
