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
const READ = `V=$(curl -fsS ${INDEX} | jq -r '.[0].sdk')`, GET = `curl -fsSLo moss.tgz "https://dl.example/moss-\${V}.tgz"`;
// (how many downloads of `code` are a program's)
const programs = (code) => programDownloads(code).length;

ok(programs(`${READ}\n${GET}\n`) === 1 && programs(`V=$(curl -s "${TXT}")\ncurl -fsSLo m.tgz "https://dl.example/m-$V.tgz"\n`) === 1,
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
  "a read by wget": `V=$(wget -qO- ${TXT})`,
  "an option beyond -fsSL": `V=$(curl -fsSK cfg ${TXT})`,
  "a program's address": `V=$(curl -fsS https://dl.example/get.sh)`,
  "a pipe into a shell after jq": `V=$(curl -fsS ${INDEX} | jq -r '.x' | sh)`,
  "a second command on the line": `V=$(curl -fsS ${INDEX}); bash run.sh`,
  "a read in JavaScript": `const s = execSync('curl -fsS ${TXT}').toString(); new Function(s)();`,
  "a read in PowerShell": `$s = irm ${INDEX}`,
};
const missed = Object.entries(forms).filter(([, line]) => programs(`${line}\n`) !== 1).map(([what]) => what);
ok(!missed.length, "each other form of a download, in a shell or another language, is a program's download", missed.join(" | "));

// A read in the one form whose variable could run, or be written, on a later line is a program's download.
const later = {
  "echoed into a shell": `echo "$V" | bash`,
  "a here-string into a shell": `bash <<< "$V"`,
  "written to a file": `printf '%s' "$V" > run.sh`,
  "an unquoted address": `curl -fsSLo m.tgz https://dl.example/m-$V.tgz`,
  "an address with another expansion": `curl -fsSLo m.tgz "https://dl.example/$(echo $V).tgz"`,
  "a use outside any download": `run "$V"`,
  "set a second time": READ,
  "a mention in a comment": "# V holds the version",
  "an indirect expansion elsewhere": `n=V; echo "\${!n}"`,
  "exported": "export V",
  "every variable printed": "env | bash",
  "every variable exported": "set -a",
  "text run as code": `eval "$X"`,
};
const kept = Object.entries(later).filter(([, line]) => programs(`${READ}\n${line}\n`) < 1).map(([what]) => what);
ok(!kept.length, "a read whose variable is used anywhere but a quoted address of another download, or in a file that could reach it by another name, is a program's download", kept.join(" | "));
ok(programs(`${READ} ${READ}\n`) === 2 && programs(`${READ} \\\n  | sh\n`) === 1, "two reads on one line, and one a continued line pipes into a shell, are programs' downloads");
// Through the scan's pin check (licence-scan.mjs's pinFault): a read of a version index asks no checksum, and a
// package of the machine's distribution that the file installs, kind "distribution", is asked no version, its
// download by address still asked a checksum (#1361, point 11).
{
  const SH = "scripts/setup.sh", sdk = { name: "dotnet-sdk-8.0", licence: "MIT", files: [SH] }, moss = { name: "mosstool", licence: "MIT", version: "1.2.0", files: [SH] };
  const INDEX = "V=$(curl -fsS https://dotnet.example/release-metadata/releases-index.json | jq -r '.[0].sdk')\n", APT = "apt-get install -y dotnet-sdk-8.0\n";
  const GET = "curl -fsSLo moss.tgz \"https://mossgrip.example/moss-${V}.tgz\"\n", CHECKED = `echo "${"0a1b2c3d".repeat(8)}  moss.tgz" | sha256sum -c -\n`;
  ok(pinFault([sdk], "audit.json", SH, `${APT}${INDEX}`) === null, "a file that reads a version index and downloads no program asks no pin of the distribution's package that covers it");
  ok(pinFault([moss], "audit.json", SH, `${INDEX}${GET}${CHECKED}`) === null, "a version index read for a program's address asks no checksum of its own");
  ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, `${INDEX}${GET}`)?.what ?? ""), "the program whose address it makes is asked its checksum");
  const bare = pinFault([sdk, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`);
  ok(/names no version/u.test(bare?.what ?? "") && /"kind": "distribution"/u.test(bare?.mend ?? ""), "an entry with no version beside a program's download is asked one, its mend naming the distribution's kind");
  ok(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${APT}${GET}${CHECKED}`) === null, "and one of kind distribution whose package the file installs is not");
  ok(/dotnet-sdk-8\.0, in audit\.json, names no version/u.test(pinFault([{ ...sdk, kind: "distribution" }, moss], "audit.json", SH, `${GET}${CHECKED}`)?.what ?? ""),
    "one of kind distribution whose package the file installs by no package manager is asked its version (#1455)");
  ok(/holds no checksum/u.test(pinFault([{ ...sdk, kind: "distribution" }], "audit.json", SH, `${APT}${GET}`)?.what ?? ""), "a download covered by a distribution's package alone is still asked its checksum");
  ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, "curl -o payload.txt https://mossgrip.example/payload.txt\nbash payload.txt\n")?.what ?? ""), "a text file kept and run on a later line is asked its checksum (#1455)");
  ok(/holds no checksum/u.test(pinFault([moss], "audit.json", SH, `${INDEX}eval "$V"\n`)?.what ?? ""), "a read in a file that runs text as code is asked its checksum");
}
done();
