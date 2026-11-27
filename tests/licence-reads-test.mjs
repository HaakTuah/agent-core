// Checks which downloads of a file the licence scan takes for reads of data, asked no checksum (scripts/licence-reads.mjs;
// #1361, point 11): one exact form alone, its variable used only inside another download's quoted address, and every
// other download a program's; and which packages of the machine's distribution are asked no version. The scan's other
// pin cases are licence-scan-pins-test.mjs's. Run by the core's tests
// workflow (.github/workflows/tests.yml).
//
//   node tests/licence-reads-test.mjs
import { done, ok } from "../scripts/licence-scan-stage.mjs";
import { programDownloads } from "../scripts/licence-reads.mjs";
import { pinFault } from "../scripts/licence-scan.mjs";

const INDEX = "https://dl.example/release-metadata/releases-index.json", TXT = "https://dl.example/release/stable.txt";
const VER = "grep -Ex '[0-9][0-9A-Za-z.+-]*'", READ = `v=$(curl -q -fsS ${INDEX} | jq -r '.[0].sdk' | ${VER})`, GET = `curl -fsSLo moss.tgz "https://dl.example/moss-\${v}.tgz"`;
// (how many downloads of `code` are a program's)
const programs = (code) => programDownloads(code).length;

ok(programs(`${READ}\n${GET}\n`) === 1 && programs(`v=$(curl -q -s "${TXT}" | ${VER})\ncurl -fsSLo m.tgz "https://dl.example/m-$v.tgz"\n`) === 1,
  "a read of a version index in the one form, its variable used only in another download's quoted address, is no program's download; that download is");
ok(programs(`${READ}\n`) === 0 && programs(`  ${READ}\n`) === 0, "a read whose variable is used nowhere is no program's download, indented or not");

// Each way a read's output could run, or be kept to run later, counts it a program's download (#1455's review).
const forms = {
  "a pipe into a shell named by its path": `curl -fsS ${TXT} | /bin/sh`,
  "a pipe of both outputs": `curl -fsS ${TXT} |& bash`,
  "a word before the shell": `curl -fsS ${TXT} | sudo -E bash`,
  "env before the shell": `curl -fsS ${TXT} | env bash`,
  "a shell of another name": `curl -fsS ${TXT} | ash`,
  "process substitution": `bash <(curl -fsS ${TXT})`,
  "process substitution sourced": `. <(curl -fsS ${TXT})`,
  "command substitution run as a command": `$(curl -fsS ${TXT})`,
  "backticks run as a command": `\`curl -fsS ${TXT}\``,
  "python run on it": `python3 -c "$(curl -fsS ${TXT})"`,
  "node run on it": `node -e "$(curl -fsS ${TXT})"`,
  "a PowerShell scriptblock": `& ([scriptblock]::Create((irm ${TXT})))`,
  "a redirect of the first output": `curl -fsS ${TXT} 1>run.sh`,
  "a redirect of both outputs": `curl -fsS ${TXT} &>run.sh`,
  "a redirect to a descriptor": `curl -fsS ${TXT} >&3`,
  "curl's output joined to its option": `curl -orun.sh ${TXT}`,
  "dd writing it": `curl -fsS ${TXT} | dd of=run.sh`,
  "PowerShell's Out-File": `irm ${TXT} | Out-File run.ps1`,
  "PowerShell's Set-Content": `irm ${TXT} | Set-Content run.ps1`,
  "PowerShell's option cut short": `iwr ${TXT} -OutF run.ps1`,
  "wget to its output, then a redirect": `wget -qO- ${TXT} 1>run.sh`,
  "a read by wget": `v=$(wget -qO- ${TXT})`,
  "an option beyond -fsSL": `v=$(curl -fsSK cfg ${TXT})`,
  "a program's address": `v=$(curl -fsS https://dl.example/get.sh)`,
  "a pipe into a shell after jq": `v=$(curl -fsS ${INDEX} | jq -r '.x' | sh)`,
  "a second command on the line": `v=$(curl -fsS ${INDEX}); bash run.sh`,
  "a read in JavaScript": `const s = execSync('curl -fsS ${TXT}').toString(); new Function(s)();`,
  "a read in PowerShell": `$s = irm ${INDEX}`,
  "a read whose output no grep holds to versions": `v=$(curl -q -fsS ${INDEX} | jq -r '.[0].sdk')`,
  "a read by curl that a config file of curl's may write": `v=$(curl -fsS ${INDEX} | jq -r '.[0].sdk' | ${VER})`,
  "a read held by another grep": `v=$(curl -q -fsS ${INDEX} | grep -Ex '.*')`,
  "a read held by a grep that is not whole lines": `v=$(curl -q -fsS ${INDEX} | grep -E '[0-9][0-9A-Za-z.+-]*')`,
};
const missed = Object.entries(forms).filter(([, line]) => programs(`${line}\n`) !== 1).map(([what]) => what);
ok(!missed.length, "each other form of a download, in a shell or another language, is a program's download", missed.join(" | "));

// A read in the one form whose variable could run, or be written, on a later line is a program's download.
const later = {
  "echoed into a shell": `echo "$v" | bash`,
  "a here-string into a shell": `bash <<< "$v"`,
  "written to a file": `printf '%s' "$v" > run.sh`,
  "an unquoted address": `curl -fsSLo m.tgz https://dl.example/m-$v.tgz`,
  "an address with another expansion": `curl -fsSLo m.tgz "https://dl.example/$(echo $v).tgz"`,
  "a use outside any download": `run "$v"`,
  "set a second time": READ,
  "a mention in a comment": "# v holds the version",
  "an indirect expansion elsewhere": `n=v; echo "\${!n}"`,
  "exported": "export v",
  "every variable printed": "env | bash",
  "every variable exported": "set -a",
  "text run as code": `eval "$X"`,
};
const kept = Object.entries(later).filter(([, line]) => programs(`${READ}\n${line}\n`) < 1).map(([what]) => what);
ok(!kept.length, "a read whose variable is used anywhere but a quoted address of another download, or in a file that could reach it by another name, is a program's download", kept.join(" | "));
ok(programs(`${READ} ${READ}\n`) === 2 && programs(`${READ} \\\n  | sh\n`) === 1, "two reads on one line, and one a continued line pipes into a shell, are programs' downloads");
// A read whose variable a shell or a program reads by itself, or whose line, or a line that uses it, stands where it is
// other than it reads (inside a string spanning lines, a here-document, a continued line, or with curl defined anew), is
// a program's download (#1455's review).
const ONE = `curl -fsSLo t.tgz "https://dl.example/t.tgz"`;
const around = {
  "the address of another command on a download's line": `${READ}\n${ONE}; bash -c "https://dl.example/$v"\n`,
  "a here-string on a download's line": `${READ}\n${ONE} && bash <<< "https://dl.example/$v"\n`,
  "node on a download's line": `${READ}\n${ONE} && node -e "https://dl.example/$v"\n`,
  "a name the shell traces by": `PS4=$(curl -q -fsS ${TXT} | ${VER})\nset -x\n${GET}\n`,
  "the search path": `PATH=$(curl -q -fsS ${TXT} | ${VER})\n${GET}\n`,
  "a proxy's name": `https_proxy=$(curl -q -fsS ${TXT} | ${VER})\n${GET}\n`,
  "a name zsh ties to the search path": `path=$(curl -q -fsS ${TXT} | ${VER})\n${GET}\n`,
  "zsh's arguments": `argv=$(curl -q -fsS ${TXT} | ${VER})\n${GET}\n`,
  "an uppercase name": `V=$(curl -q -fsS ${TXT} | ${VER})\ncurl -fsSLo m.tgz "https://dl.example/m-$V.tgz"\n`,
  "the last word of the command before": `${READ}\n${GET}\nbash -c "$_"\n`,
  "grep a function": `grep() { cat; }\n${READ}\n${GET}\n`,
  "jq an alias": `alias jq='bash -c'\n${READ}\n${GET}\n`,
  "a string spanning lines": `bash -c "\n${READ}\n"\n${GET}\n`,
  "a here-document": `bash <<EOF\n${READ}\nEOF\n${GET}\n`,
  "a continued line": `bash -c \\\n${READ}\n${GET}\n`,
  "a use on a continued line": `${READ}\nbash -c \\\n${GET}\n`,
  "curl a function": `curl() { bash -c "$*"; }\n${READ}\n${GET}\n`,
  "curl an alias": `alias curl='bash -c'\n${READ}\n${GET}\n`,
  // (grep, jq or curl found elsewhere, #1455's fourth review)
  "the search path set": `PATH=/tmp/x\n${READ}\n${GET}\n`,
  "the search path added to": `PATH+=:/tmp/x\n${READ}\n${GET}\n`,
  "zsh's search path added to": `#!/bin/zsh\npath+=(/tmp/x)\n${READ}\n${GET}\n`,
  "a search path a workflow's step adds": `echo /tmp/x >> "$GITHUB_PATH"\n${READ}\n${GET}\n`,
  "a name hashed to another program": `hash -p /tmp/x grep\n${READ}\n${GET}\n`,
  "a builtin loaded": `enable -f /tmp/x.so grep\n${READ}\n${GET}\n`,
  "a file read in by a dot": `. ./lib.sh\n${READ}\n${GET}\n`,
  "a file read in by a dot after another command": `cd tools && . lib.sh\n${READ}\n${GET}\n`,
  "a file read in by source": `source lib.sh\n${READ}\n${GET}\n`,
  "a file bash reads at its start": `echo BASH_ENV=lib.sh >> "$GITHUB_ENV"\n${READ}\n${GET}\n`,
  // (those names quoted or escaped in part, #1455's fifth review)
  "a dot quoted": `"." ./lib.sh\n${READ}\n${GET}\n`,
  "a dot escaped": `\\. ./lib.sh\n${READ}\n${GET}\n`,
  "source quoted in part": `so""urce ./lib.sh\n${READ}\n${GET}\n`,
  "hash quoted in part": `ha''sh -p ./tools/grep grep\n${READ}\n${GET}\n`,
  // (a dot in any other place a command stands, #1455's sixth review)
  "a dot as an if's condition": `if . ./lib.sh; then :; fi\n${READ}\n${GET}\n`,
  "a dot after !": `! . ./lib.sh\n${READ}\n${GET}\n`,
  "a dot after time": `time . ./lib.sh\n${READ}\n${GET}\n`,
  "a dot after builtin": `builtin . ./lib.sh\n${READ}\n${GET}\n`,
  "a dot after command": `command . ./lib.sh\n${READ}\n${GET}\n`,
  "a dot after an assignment": `X=1 . ./lib.sh\n${READ}\n${GET}\n`,
  // (a dot or a name continued on the next line, #1455's seventh review)
  "a dot continued": `. \\\n./lib.sh\n${READ}\n${GET}\n`,
  "a dot continued before its space": `.\\\n ./lib.sh\n${READ}\n${GET}\n`,
  "hash continued in mid-word": `ha\\\nsh -p ./tools/grep grep\n${READ}\n${GET}\n`,
  "grep defined, continued in mid-word": `gr\\\nep() { sh; }\n${READ}\n${GET}\n`,
  // (a line that ends in an escaped backslash, which continues nothing, #1455's eighth review)
  "a dot after a line that ends in an escaped backslash": `echo foo\\\\\n. ./lib.sh\n${READ}\n${GET}\n`,
  "grep defined after a line that ends in an escaped backslash": `echo x\\\\\ngrep() { sh; }\n${READ}\n${GET}\n`,
  // (bash's own joining, after such a line, #1455's ninth review)
  ". continued after a line that ends in an escaped backslash": `echo x\\\\\n. \\\n./lib.sh\n${READ}\n${GET}\n`,
  "grep defined in parts after a line that ends in an escaped backslash": `echo x\\\\\ngr\\\nep() { sh; }\n${READ}\n${GET}\n`,
};
const through = Object.entries(around).filter(([, code]) => programs(code) < 2).map(([what]) => what);
ok(!through.length, "a read whose variable a shell reads by itself, or that stands other than it reads, is a program's download", through.join(" | "));
ok(programs(`find . -name "*.tgz" -delete\n${READ}\n${GET}\n`) === 2, "a dot that is an argument, of find, costs the read its reading as data: any word . with a word after it is read as a file read in");
ok(programs(`# set up the tool's version; it's read below\n${READ}\n${GET}\n`) === 1, "a comment with a quote in it before the read leaves the read one of data");
// Through the scan's pin check (licence-scan.mjs's pinFault): a read of a version index asks no checksum, and a
// package of the machine's distribution that the file installs, kind "distribution", is asked no version, its
// download by address still asked a checksum (#1361, point 11).
{
  const SH = "scripts/setup.sh", sdk = { name: "dotnet-sdk-8.0", licence: "MIT", files: [SH] }, moss = { name: "mosstool", licence: "MIT", version: "1.2.0", files: [SH] };
  const INDEX = "v=$(curl -q -fsS https://dotnet.example/release-metadata/releases-index.json | jq -r '.[0].sdk' | grep -Ex '[0-9][0-9A-Za-z.+-]*')\n", APT = "apt-get install -y dotnet-sdk-8.0\n";
  const GET = "curl -fsSLo moss.tgz \"https://mossgrip.example/moss-${v}.tgz\"\n", CHECKED = `echo "${"0a1b2c3d".repeat(8)}  moss.tgz" | sha256sum -c -\n`;
  ok(pinFault([sdk], "audit.json", SH, `${APT}${INDEX}`) === null, "a file that reads a version index and downloads no program asks no pin of the distribution's package that covers it");
  ok(pinFault([moss], "audit.json", SH, `${INDEX}${GET}${CHECKED}`) === null, "a version index read for a program's address asks no checksum of its own");
  ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, `${INDEX}${GET}`)?.what ?? ""), "the program whose address it makes is asked its checksum");
  const bare = pinFault([sdk, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`);
  ok(/names no version/u.test(bare?.what ?? "") && /"kind": "distribution"/u.test(bare?.mend ?? ""), "an entry with no version beside a program's download is asked one, its mend naming the distribution's kind");
  ok(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`) === null, "and one of kind distribution whose package the file installs is not");
  ok(/dotnet-sdk-8\.0, in audit\.json, names no version/u.test(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${GET}${CHECKED}`)?.what ?? ""),
    "one of kind distribution whose package the file installs by no package manager is asked its version (#1455)");
  const dist = (code) => pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${code}${GET}${CHECKED}`);
  ok(["sudo apt-get install -y dotnet-sdk-8.0\n", "RUN apk add --no-cache dotnet-sdk-8.0\n", "apt-get update && apt-get install -y curl dotnet-sdk-8.0\n", "      - run: sudo apt-get install -y dotnet-sdk-8.0\n"].every((c) => dist(c) === null)
    && ["apt-get remove dotnet-sdk-8.0\n", "echo \"brew users: brew install dotnet-sdk-8.0\"\n", "apt-get install -y dotnet-sdk-8.0-extra\n"].every((c) => /names no version/u.test(dist(c)?.what ?? "")),
  "an install by a package manager's own command, by sudo, in a RUN, after && or in a workflow's one-line run, counts; a removal, an echo naming one or another package's name does not (#1455)");
  ok(/holds no checksum/u.test(pinFault([{ ...sdk, kind: "distribution" }], "audit.json", SH, `${APT}${GET}`)?.what ?? ""), "a download covered by a distribution's package alone is still asked its checksum");
  ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, "curl -o payload.txt https://mossgrip.example/payload.txt\nbash payload.txt\n")?.what ?? ""), "a text file kept and run on a later line is asked its checksum (#1455)");
  ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, `${INDEX}eval "$v"\n`)?.what ?? ""), "a read in a file that runs text as code is asked its checksum");
}
done();
