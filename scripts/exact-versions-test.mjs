// Checks the exact-versions check (exact-versions.mjs, beside this file): a range, a tag or an address that can move
// fails, and one exact version or a package of the project's own passes. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node scripts/exact-versions-test.mjs
import { problems, reads, workspaces } from "./exact-versions.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const sha = "0123456789abcdef0123456789abcdef01234567";
const fails = (spec, own) => problems({ dependencies: { mossgrip: spec } }, own).length > 0;

ok(!fails("1.5.4") && !fails("2.0.0-rc.1") && !fails("1.5.4+build.7"), "one exact version passes, with a pre-release or build part too");
ok(["^1.5.4", "~1.5.4", ">=1.5.4", "1.5.x", "1.5", "1", "*", "", "1.5.4 || 2.0.0", "1.5.4 - 1.6.0", "latest", "next"].every(s => fails(s)), "a range, a partial version, a star, nothing and a tag each fail");
ok(!fails("npm:barkbite@1.5.4") && !fails("npm:@log/barkbite@1.5.4") && fails("npm:barkbite@^1.5.4") && fails("npm:barkbite"), "an alias passes only at one exact version");
ok([`git+https://example.com/log/mossgrip.git#${sha}`, `github:log/mossgrip#${sha}`, `log/mossgrip#${sha}`, `https://github.com/log/mossgrip.git#${sha}`, `https://gitlab.com/log/mossgrip#${sha}`, `git@example.com:log/mossgrip.git#${sha}`, `git+https://example.com/log/mossgrip.git#${sha}`, `git+ssh://git@example.com/log/mossgrip.git#${sha}`].every(s => !fails(s)), "a git address at a full commit SHA passes, in each form npm reads as one");
ok(fails(`https://example.com/log/mossgrip.git#${sha}`) && fails(`https://github.com.example.com/log/mossgrip.git#${sha}`) && fails(`http://github.com/log/mossgrip.git#${sha}`), "a plain web address off the hosts npm knows is a download, whatever follows it, and fails");
ok(fails(`../mossgrip#${sha}`) && fails(`./log/mossgrip#${sha}`) && fails(`.log/mossgrip#${sha}`), "a path with a SHA after it is no git address");
ok(fails(`https://example.com/mossgrip.tgz#${sha}`) && fails(`log/mossgrip#semver:^1.0.0`) && fails(`log/mossgrip#${sha.slice(0, 7)}`), "a file on the web with a SHA after it, a range of tags and a short SHA each fail");
ok(fails("git+https://example.com/log/mossgrip.git#main") && fails("github:log/mossgrip") && fails("log/mossgrip") && fails("https://example.com/mossgrip.tgz"), "a git address at a branch or at nothing, and a file on the web, each fail");
const at = (spec, dir) => problems({ dependencies: { mossgrip: spec } }, new Set(), dir).length > 0;
ok(!at("file:../mossgrip", "src/web") && !at("link:./parts/mossgrip", "") && !at("file:..\\..\\kit", "src/web"), "a path that stays in the project passes");
ok(at("file:../mossgrip", "") && at("file:../../../elsewhere", "src/web") && at("file:/tmp/mossgrip", "") && at("file:~/mossgrip", "") && at("file:C:\\mossgrip", "") && at("file:", "") && at("link:", "src"), "a path that leaves the project, an absolute one and an empty one each fail");
const own = new Set(["mossgrip"]);
ok(!fails("*", own) && !fails("workspace:*", own) && !fails("workspace:^", own) && fails("workspace:*") && fails("*"), "a workspace of the project's own passes as * or by workspace:; another package does not");
ok(fails("npm:barkbite@latest", own) && fails("^1.5.4", own) && fails("latest", own), "a workspace's name on what is fetched from outside exempts nothing");
const lists = [{ file: "package.json", pkg: { name: "log", workspaces: ["src/*", "./tools/sim/"] } }, { file: "src/engine/package.json", pkg: { name: "mossgrip" } },
  { file: "src/web/deep/package.json", pkg: { name: "too-deep" } }, { file: "tools/sim/package.json", pkg: { name: "barkbite" } },
  { file: "docs/sample/package.json", pkg: { name: "unrelated" } }, { file: "kit/package.json", pkg: { name: "kit", workspaces: { packages: ["parts/**"] } } },
  { file: "kit/parts/a/b/package.json", pkg: { name: "kit-part" } }, { file: "broken/package.json", pkg: null }];
const left = workspaces([{ file: "package.json", pkg: { workspaces: ["!packages/outside", "packages/*"] } }, { file: "packages/inside/package.json", pkg: { name: "inside" } }, { file: "packages/outside/package.json", pkg: { name: "outside" } }]);
ok([...left.get("package.json")].join() === "inside" && !left.has("packages/outside/package.json"), "a folder a \"!\" leaves out is no workspace, wherever the \"!\" stands");
const mine = workspaces(lists), names = file => [...mine.get(file) ?? []].sort().join();
ok(names("package.json") === "barkbite,mossgrip" && names("src/engine/package.json") === "barkbite,mossgrip" && names("kit/package.json") === "kit-part" && names("kit/parts/a/b/package.json") === "kit-part",
  "a list that names \"workspaces\", and each of them, may ask for them as the project's own");
ok(names("docs/sample/package.json") === "" && names("src/web/deep/package.json") === "" && !mine.has("broken/package.json") && !names("package.json").includes("kit-part"),
  "a package list no \"workspaces\" names may ask for none, and one project's workspaces are not another's");
ok(problems({ devDependencies: { a: "^1.0.0" }, optionalDependencies: { b: "1.x" }, peerDependencies: { c: ">=1" } }).length === 3, "every list of the package list is read");
ok(problems({ overrides: { a: "1.0.0", b: { ".": "1.0.0", c: "$c" } } }).length === 0 && problems({ overrides: { a: "^1.0.0", b: { c: "2.x" } } }).length === 2, "overrides too, at every depth; a reference to the project's own choice passes");
ok(problems({ dependencies: { a: 1 } }).length === 1 && problems({}).length === 0, "a version that is no text fails; a package list that asks for nothing passes");

const files = ["package.json", "src/web/package.json", "core/package.json", "tools/node_modules/a/package.json", "docs/package.json.md", "package-lock.json"];
ok(reads(files).join() === "package.json,src/web/package.json", "it reads the project's own package lists, and neither the core's copy nor an installed package's");
process.exit(failed ? 1 : 0);
