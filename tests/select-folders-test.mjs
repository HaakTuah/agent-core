// Tests the files a test reaches by listing a folder (scripts/select-folders.mjs; #1361, point 25), through the
// selection's links (select.mjs's links and reached): a folder a string names by its path or its last parts, a pattern
// before its wildcard, the file's own folder and those above it, in JavaScript and Python, a template literal's and an f-string's literal pieces, a folder outside the
// repository and a string past twice the longest path, which name none, and a string that names a folder in a file that
// lists none. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-folders-test.mjs
import { links, reached } from "../scripts/select.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const texts = {
  "game/board.js": "var Board = {};\n", "game/rules/turn.js": "var Turn = {};\n", "engine/loop.js": "var Loop = {};\n",
  "tools/layout/bar.js": "var Bar = {};\n", "tools/helpers.js": "module.exports = {};\n", "data/maps/one.py": "ONE = 1\n",
  "tools/online-test.js": "const ROOT = path.join(__dirname, '..');\nconst code = fs.readdirSync(path.join(ROOT, 'game')).map(f => `game/${f}`);\n",
  "tools/layout-test.js": "const DIR = path.join(__dirname, 'layout');\nfor (const f of fs.readdirSync(DIR)) run(f);\n",
  "tools/scope-test.js": "const own = fs.readdirSync(__dirname).filter(f => f.endsWith('.js'));\n",
  "tools/rules-test.js": "for (const f of globSync(\"game/rules/**/*.js\")) load(f);\n",
  "tools/loop-test.js": "const where = 'engine'; // names a folder, lists none\n",
  "tools/up-test.js": "const all = fs.readdirSync(path.join(__dirname, '..'));\nconst ROOT = path.join(__dirname, '..');\n",
  "docs/deep/deep-test.js": "for (const f of fs.readdirSync('../../game')) run(f);\n",
  "tools/served-test.js": "const walk = d => fs.readdirSync(path.join(ROOT, d)).flatMap(f => f);\nconst served = walk('.');\nconst say = ['a', 'b'].join('.') + where + '.';\n",
  "tools/dot-test.js": "const here = '.';\nfor (const f of fs.readdirSync('game')) run(f);\n",
  "tools/all-test.js": "for (const f of globSync('**/*.js')) load(f);\n",
  "tools/walk-test.js": "const walk = (v, at) => Object.keys(v).map(k => walk(v[k], at + '.' + k));\nconst none = [].join('');\nfs.readdirSync(path.join(ROOT, 'game'));\n",
  "tests/maps_test.py": "import os\nfor f in os.listdir(\"data/maps\"):\n    run(f)\n",
  "tools/template-test.js": "for (const f of fs.readdirSync(`${ROOT}/engine`)) load(f);\n",
  "tests/fstring_test.py": "for f in os.listdir(f\"{ROOT}/data/maps\"):\n    run(f)\n",
  "tools/sync-test.js": "for (const f of fg.sync('engine/*.js')) load(f);\n",
  "tools/outside-test.js": "for (const f of fs.readdirSync('../../../etc')) load(f);\nfs.readdirSync(`${'a/'.repeat(9)}${'../'.repeat(9)}`);\n",
};
const tests = Object.keys(texts).filter(f => /[-_]test\.(js|py)$/u.test(f));
const reach = reached(tests, links(texts, tests, new Map()));
const has = (t, files) => files.every(f => reach.get(t).has(f));

ok(has("tools/online-test.js", ["game/board.js", "game/rules/turn.js"]) && !reach.get("tools/online-test.js").has("engine/loop.js"),
  "a folder a string names by its path from the root reaches every file under it, and no other folder", [...reach.get("tools/online-test.js")]);
ok(has("tools/layout-test.js", ["tools/layout/bar.js"]) && !reach.get("tools/layout-test.js").has("game/board.js"),
  "a folder named by its last part, through a name the listing is handed", [...reach.get("tools/layout-test.js")]);
ok(has("tools/scope-test.js", ["tools/helpers.js", "tools/layout/bar.js", "tools/online-test.js"]),
  "a listing of the file's own folder reaches every file under it", [...reach.get("tools/scope-test.js")]);
ok(has("tools/rules-test.js", ["game/rules/turn.js"]) && !reach.get("tools/rules-test.js").has("game/board.js"),
  "a pattern names the folder before its wildcard", [...reach.get("tools/rules-test.js")]);
ok(has("tests/maps_test.py", ["data/maps/one.py"]), "a listing in Python", [...reach.get("tests/maps_test.py")]);
ok(reach.get("tools/loop-test.js").size === 1, "a string that names a folder, in a file that lists none, reaches nothing", [...reach.get("tools/loop-test.js")]);
ok(has("tools/up-test.js", ["game/board.js", "engine/loop.js", "data/maps/one.py"]),
  "a listing of the folder above the file's own reaches every file under it, here the root's", [...reach.get("tools/up-test.js")]);
ok(has("docs/deep/deep-test.js", ["game/board.js"]) && !reach.get("docs/deep/deep-test.js").has("engine/loop.js"),
  "a folder named by its path from the file's own, above it", [...reach.get("docs/deep/deep-test.js")]);
ok(has("tools/served-test.js", ["game/board.js", "engine/loop.js"]), "a listing of `.`, the root, reaches every file", [...reach.get("tools/served-test.js")]);
ok(has("tools/dot-test.js", ["game/board.js"]) && !reach.get("tools/dot-test.js").has("engine/loop.js"), "a `.` on a line that lists nothing names no folder", [...reach.get("tools/dot-test.js")]);
ok(has("tools/all-test.js", ["game/board.js", "data/maps/one.py"]), "a pattern that starts with a wildcard reaches every file", [...reach.get("tools/all-test.js")]);
ok(!reach.get("tools/walk-test.js").has("engine/loop.js"), "a `.` joined to a name, and an empty string, name no root", [...reach.get("tools/walk-test.js")]);
ok(has("tools/template-test.js", ["engine/loop.js"]) && !reach.get("tools/template-test.js").has("game/board.js"),
  "a template literal's literal piece names a folder", [...reach.get("tools/template-test.js")]);
ok(has("tests/fstring_test.py", ["data/maps/one.py"]), "a Python f-string's literal piece names a folder", [...reach.get("tests/fstring_test.py")]);
ok(has("tools/sync-test.js", ["engine/loop.js"]), "a listing through `fg.sync`", [...reach.get("tools/sync-test.js")]);
ok(reach.get("tools/outside-test.js").size === 1, "a folder outside the repository never counts", [...reach.get("tools/outside-test.js")]);
const long = { "a/b.js": "1\n", "t-test.js": `fs.readdirSync("${"a/".repeat(50)}${"../".repeat(50)}a");\n` };
ok(!reached(["t-test.js"], links(long, ["t-test.js"], new Map())).get("t-test.js").has("a/b.js"), "a string longer than twice the longest path names no folder");
done("the files a test reaches by listing a folder");
