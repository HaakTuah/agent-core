// Checks the licence scan (scripts/licence-scan.mjs, with its readers licence-commands.mjs, licence-npm.mjs,
// licence-fetchers.mjs and licence-pages.mjs) on the forms of an npm or npx command line in a script, and the command reader on its own (fetched), each
// staged in the project licence-scan-stage.mjs writes and failing for the reason it names. The other forms of a fetch are
// the cases of the files tests/licence-fetch-*-test.mjs. Run by the core's tests workflow (.github/workflows/tests.yml).
//   node tests/licence-fetch-test.mjs
import { fetched } from "../scripts/licence-npm.mjs";
import { append, done, handAudited, ok, run, write } from "../scripts/licence-scan-stage.mjs";

for (const [what, change, why] of [
  ["npm install of a package not in the audit", append("scripts/setup.sh", "npm install -g mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install with an option before install", append("scripts/setup.sh", "npm -g install mossgrip-widgets\n"), /cannot be audited/],
  ["npm install with an option and its value before install", append("scripts/setup.sh", "npm --prefix tools install mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["npm i after its log level", append("scripts/setup.sh", "npm --loglevel error i mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install spelt another way", append("scripts/setup.sh", "npm isntall mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install-test", append("scripts/setup.sh", "npm it mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm pack of a package not in the audit", append("scripts/setup.sh", "npm pack mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm pack of a variable", append("scripts/setup.sh", 'npm pack --ignore-scripts "moss-linux-$ARCH@$V"\n'), /moss-linux-\$ARCH@\$V cannot be audited/],
  ["npm create, which fetches by another name", append("scripts/setup.sh", "npm create mossgrip\n"), /by another name/],
  ["npm init of a package", append("scripts/setup.sh", "npm init mossgrip@1.2.3\n"), /by another name/],
  ["npm install without a version", append("scripts/setup.sh", "npm install --no-save mossgrip-cli\n"), /cannot be audited/],
  ["npm install of a major version alone", append("scripts/setup.sh", "npm install -g --prefix /opt/moss mossgrip-cli@1\n"), /mossgrip-cli@1 cannot be audited/],
  ["npm install of a range", append("scripts/setup.sh", "npm install mossgrip-cli@^1.2.3\n"), /cannot be audited/],
  ["npm install of an alias", append("scripts/setup.sh", "npm install mossgrip-cli@npm:mossgrip-lint@9.0.0\n"), /cannot be audited/],
  ["npm install from a URL", append("scripts/setup.sh", "npm install https://mossgrip.example/widgets.tgz\n"), /cannot be audited/],
  ["npm install from git", append("scripts/setup.sh", "npm install git+https://mossgrip.example/widgets.git\n"), /cannot be audited/],
  ["npm install of a variable", append("scripts/setup.sh", 'npm i "$PKG"\n'), /\$PKG cannot be audited/],
  ["npm install continued on the next line", append("scripts/setup.sh", "npm install -g \\\n  mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npx of a package without a version", append("scripts/setup.sh", "npx -y mossgrip-cli build\n"), /cannot be audited/],
  ["npx of a bare name, even in a file an entry audits by hand", (dir) => { handAudited("scripts/setup.sh")(dir); append("scripts/setup.sh", "npx -y mossgrip-cli build\n")(dir); }, /cannot be audited/],
  ["npm exec of a package without a version", append("scripts/setup.sh", "npm exec -- mossgrip-cli build\n"), /cannot be audited/],
  ["npx after a # inside a string, which is no comment", append("scripts/setup.sh", 'echo "# a heading"; npx -y mossgrip-widgets\n'), /cannot be audited/],
  ["npm install after an option and its value it does not know", append("scripts/setup.sh", "npm --location global install mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["npm install after a date given to an option", append("scripts/setup.sh", "npm --before 2020-01-01 install mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npx --no undone by --yes", append("scripts/setup.sh", "npx --no --yes mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["npm install after an option whose value is a command's name", append("scripts/setup.sh", "npm --otp run install mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["npm install after --color, a flag", append("scripts/setup.sh", "npm --color install mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["npm with another config file", append("scripts/setup.sh", "npm --userconfig tools/moss.npmrc install mossgrip-cli@1.2.3\n"), /another npm config/],
  ["npm pointed at another registry by npm config set", append("scripts/setup.sh", "npm config set registry https://mossgrip.example/\nnpm install -g mossgrip-cli@1.2.3\n"), /another registry or config/],
  ["a scope pointed at another registry by npm set", append("scripts/setup.sh", "npm set @moss:registry https://mossgrip.example/\n"), /another registry or config/],
  ["npm audit fix, which installs newer releases", append("scripts/setup.sh", "npm audit fix --force\n"), /audit fix installs/],
  ["npm install in Windows' spelling", append("scripts/setup.sh", "npm.cmd install mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install nested in npx -c", append("scripts/setup.sh", "npx --package=mossgrip-cli@1.2.3 -c 'npm install -g mossgrip-widgets@1.2.3'\n"), /mossgrip-widgets .* is not in/],
  ["a package given to npx by -p=", append("scripts/setup.sh", "npx -p=mossgrip-widgets@1.2.3 --package=mossgrip-cli@1.2.3 moss\n"), /mossgrip-widgets .* is not in/],
  ["npx with --no-install undone by --yes=true", append("scripts/setup.sh", "npx --no-install --yes=true mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npx held in a shell variable", append("scripts/setup.sh", "NPX=npx\n$NPX -y mossgrip-cli\n"), /program-held-in-a-variable|cannot be audited/],
  ["npm held in a shell variable", append("scripts/setup.sh", "bin=\"npm\"\n\"$bin\" install mossgrip-widgets\n"), /program-held-in-a-variable|cannot be audited/],
  ["npx with a redirection before its package", append("scripts/setup.sh", "npx >moss.log mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm install with a redirection before its package", append("scripts/setup.sh", "npm install >moss.log -g mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["npm link of a package, which installs it if missing", append("scripts/setup.sh", "npm link mossgrip-widgets@1.2.3\nnpm ln mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ["a shell variable declared local to hold npx", append("scripts/setup.sh", "moss() {\n  local bin=npx\n  $bin -y mossgrip-cli\n}\n"), /program-held-in-a-variable|cannot be audited/],
  ["a shell variable declared read-only to hold npm", append("scripts/setup.sh", "readonly NPM=npm\n$NPM install mossgrip-widgets\n"), /program-held-in-a-variable|cannot be audited/],
  ["a shell variable holding npx with its options", append("scripts/setup.sh", "NPX=\"npx -y\"\n$NPX mossgrip-cli\n"), /names nothing to run here/],
  ["npx found by command -v", append("scripts/setup.sh", "bin=$(command -v npx)\n$bin -y mossgrip-cli\n"), /names nothing to run here/],
  ["npx found by which, in backquotes or in code", (dir) => { append("scripts/setup.sh", "bin=`which npx`\n$bin -y mossgrip-cli\n")(dir); write("scripts/run.mjs", "const bin = execSync('which npx');\n")(dir); }, /names nothing to run here/],
  ["npm update, which takes the newest a range allows", append("scripts/setup.sh", "npm update -g mossgrip-cli\n"), /newest release a range allows/],
  ["a second package given to npm exec after its command", append("scripts/setup.sh", "npm exec --package=mossgrip-cli@1.2.3 moss --package=mossgrip-widgets@1.2.3 -- -v\n"), /mossgrip-widgets .* is not in/],
  ["npm exec of a bare name after --", append("scripts/setup.sh", "npm exec -- mossgrip-widgets\n"), /mossgrip-widgets cannot be audited/],
  ["an audited package fetched from another registry", append("scripts/setup.sh", "npm install --registry https://mossgrip.example -g mossgrip-cli@1.2.3\n"), /another registry/],
  ["npm pointed at another registry by its environment", append("scripts/setup.sh", "npm_config_registry=https://mossgrip.example npx mossgrip-cli@1.2.3\n"), /another registry/],
  ...["npm $VERB mossgrip-widgets@1.2.3", 'if npm "$VERB" x; then :; fi', "sh -c 'npm $VERB x'", 'NODE_ENV=production npm "$VERB" x',
    'sudo -E npm "$VERB" x', 'timeout 60 npm "$VERB" x', 'nice npm "$VERB" x', '/usr/bin/npm "$VERB" x',
    `PAD="${"x ".repeat(200)}" npm "$VERB" x`, 'npx --no-install cross-env A=1 npm "$VERB" x', '"$SUDO" npm "$VERB" x',
    '${SUDO} npm "$VERB" x', `sudo${" -ux".repeat(70)} npm "$VERB" x`, 'sudo -Hu root npm "$VERB" x', 'sudo --user root npm "$VERB" x',
    'timeout --signal KILL 60 npm "$VERB" x', 'eval npm "$VERB" x', 'eval "npm $VERB x"', 'flock /tmp/moss.lock npm "$VERB" x',
    'npx concurrently -k "npm run moss" "npm $VERB x"', 'nodemon --exec "npm $VERB x"', `PAD="${"x".repeat(5000)}" npm "$VERB" x`,
    `concurrently "${"x".repeat(5000)}" "npm $VERB x"`, `concurrently --${"x".repeat(5000)} "npm $VERB x"`,
  ].map((line) => [`a word after npm that is no npm command, where npm stands as one: ${line}`, append("scripts/setup.sh", `${line}\n`), /no npm command/]),
  ...["npm install --ignore-scripts --no-package-lock", "npm i --package-lock=false", "npm i --package-lock false", "npm --no-package-lock install --ignore-scripts"]
    .map((line) => [`npm install without its lockfile: ${line}`, append("scripts/setup.sh", `${line}\n`), /without the lockfile/]),
  ["npm install with the lockfile turned off by its environment", append("scripts/setup.sh", "npm_config_package_lock=false npm install --ignore-scripts\n"), /without the lockfile/],
  ...["npm install --cache '#cache' -g mossgrip-widgets@1.2.3", "npm install --cache '>' -g mossgrip-widgets@1.2.3"]
    .map((line) => [`a quoted value that only looks like a comment or a redirection: ${line}`, append("scripts/setup.sh", `${line}\n`), /mossgrip-widgets .* is not in/]),
  ...['npm install --message "release #1" -g mossgrip-widgets@1.2.3', "npm install --cache 'moss #cache' -g mossgrip-widgets@1.2.3", "npm install --cache 'moss > bark' -g mossgrip-widgets@1.2.3"]
    .map((line) => [`a # or > inside a quoted value of several words: ${line}`, append("scripts/setup.sh", `${line}\n`), /mossgrip-widgets .* is not in/]),
  ["npm diff of a git package, which prepares it", append("scripts/setup.sh", "npm diff --diff=git+https://mossgrip.example/widgets.git --diff=.\n"), /cannot be audited/],
  ["npm cache add of a package", append("scripts/setup.sh", "npm cache add mossgrip-widgets@1.2.3\n"), /mossgrip-widgets .* is not in/],
  ...["npm cache add https://mossgrip.example/widgets.tgz", "npm diff --diff=https://mossgrip.example/widgets.tgz --diff=.",
    "npm --diff=git+https://mossgrip.example/widgets.git --diff=. diff"]
    .map((line) => [`a remote package fetched by npm: ${line}`, append("scripts/setup.sh", `${line}\n`), /cannot be audited/]),
  ["a command running on too long to read", append("scripts/setup.sh", `npm ci${" --moss".repeat(4000)}\n`), /a-command-too-long-to-read/],
  ["npm publish of a git package", append("scripts/setup.sh", "npm publish git+https://mossgrip.example/widgets.git\n"), /cannot be audited/],
]) { const f = run(change); ok(f.some((m) => why.test(m)), `fails on ${what}`, f.join("\n") || "(it passed)"); }


// The command reader on its own (fetched): what a line's words are read as, past a comment, a redirection, quotes and
// the spelling of Windows, and which words say it fetches from another registry or config than npm's.
const ANOTHER = /another registry/;
for (const [line, literal, specs, unreadable] of [
  ["pnpm install --registry https://x y", false, []],
  ["npm i --no-registry y", false, ["y"]], ["npm i -registry y", false, [], ANOTHER], ["npm i --@moss-co:registry=u y", false, [], ANOTHER],
  ["npm i foo--replace-registry-host", false, ["foo--replace-registry-host"]], ["npm i --replace-registry-host=all y", false, [], ANOTHER],
  ["npm i --userconfig=x y", false, [], ANOTHER], ["npm i --globalconfig x y", false, [], ANOTHER], ["npm i y --no-userconfig", false, ["y"]],
  ["npm i y npm_config_userconfig=x", false, [], ANOTHER], ["npm i y npm_config_cache=z", false, ["y", "npm_config_cache=z"]],
  ["npm i a # c b", false, ["a"]], ["npm i a //c b", false, ["a"]], ["npm i a #c b", true, ["a", "#c", "b"]], ["npm i 'a #c' b", false, ["a", "#c", "b"]],
  ["npm i a > log b", false, ["a", "b"]], ["npm i a 2>log b", false, ["a", "b"]], ["npm i a &>log", false, ["a"]], ["npm i a >&2 b", false, ["a", "b"]],
  ["npm i a <in b", false, ["a", "b"]], ["npm i a x<in b", false, ["a", "x<in", "b"]], ["npm i a >log2 b >", true, ["a", ">log2", "b", ">"]],
  ["npm ' + 'install x", false, ["x"]], ["npm i ('a'),", false, ["a"]], ["NPM.CMD i x", false, ["x"]], ["npx.cmd -y y", false, ["y"]],
  ["npm\ti  x", false, ["x"]], ["  npm i  x  ", false, ["x"]],
]) {
  const got = fetched(line, false, literal);
  ok(JSON.stringify(got.specs) === JSON.stringify(specs) && (unreadable ? unreadable.test(got.unreadable ?? "") : got.unreadable === undefined), `fetched reads "${line}" as ${unreadable ? "unreadable" : JSON.stringify(specs)}`, JSON.stringify(got));
}

done();
