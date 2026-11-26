// Tests the step's shell with the network cut off (scripts/offline.sh; #770): with sudo, unshare, ip and setpriv
// stood in for, so it runs anywhere bash does, it runs the step's script as GitHub's bash does (-e, pipefail), with the
// environment it was started with, keeps the script's status, says the mend where a failure shows a fetch the cut
// refused and nothing more where none does, and never runs the script where the cut could not be made. Where this test
// itself runs under the cut, as each step of the core's suites on Linux does, it reads that the cut stands: no name
// resolves and no address outside is reached, while loopback answers. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/offline-test.mjs
import { spawnSync } from "node:child_process";
import dns from "node:dns/promises";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/offline.sh", import.meta.url));

if (process.platform === "win32") console.log("note the step's shell with the network cut off runs on Linux alone, where its jobs run: not run here");
else {
  const tmp = scratchDir("offline-");
  const bin = path.join(tmp, "bin");
  const temps = path.join(tmp, "temps");
  fs.mkdirSync(bin);
  fs.mkdirSync(temps);
  // (each stand-in runs what follows its options, as the real one does once it has done its part; ip and sudo fail
  // where the case asks)
  const stub = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
  stub("sudo", '[ -n "${STUB_SUDO_FAILS:-}" ] && { echo "sudo: a password is required" >&2; exit 1; }\n[ "$1" = -n ] && shift\nexec "$@"');
  stub("unshare", 'while [ "$1" != -- ]; do shift; done; shift\nexec "$@"');
  stub("setpriv", 'while [ "$1" != -- ]; do shift; done; shift\nexec "$@"');
  stub("ip", '[ -n "${STUB_IP_FAILS:-}" ] && { echo "RTNETLINK answers: Operation not permitted" >&2; exit 2; }\nexit 0');
  const run = (text, env = {}) => {
    const file = path.join(tmp, `step-${count}.sh`);
    fs.writeFileSync(file, text);
    const r = spawnSync("bash", [script, file], { encoding: "utf8", cwd: tmp, env: { ...process.env, CORE_OFFLINE: "", TMPDIR: temps, PATH: `${bin}${path.delimiter}${process.env.PATH}`, ...env } });
    return { status: r.status, said: `${r.stdout}${r.stderr}`, saw: `status ${r.status}${r.signal ? ` (signal ${r.signal})` : ""}${r.error ? `, error ${r.error.message}` : ""}, output: ${JSON.stringify(`${r.stdout}${r.stderr}`)}` };
  };
  const marker = path.join(tmp, "ran");

  const passes = run('[ "$CORE_OFFLINE" = 1 ]\n[ "$KEPT" = "a b\nc=d" ]\nenv | grep -x "A-B=x" > /dev/null\n[ "$PWD" = "$EXPECTED_PWD" ]\necho step ran\n', { KEPT: "a b\nc=d", "A-B": "x", EXPECTED_PWD: fs.realpathSync(tmp) });
  ok(passes.status === 0 && passes.said.includes("step ran") && !/FAIL/.test(passes.said),
    "a step's script runs with the environment and folder it was started with, exactly, a name bash cannot export among it, CORE_OFFLINE set, and passes as it would", passes.saw);

  const strict = run("false | true\necho past the pipe\nfalse\necho past the failure\n");
  ok(strict.status !== 0 && !strict.said.includes("past the pipe") && !strict.said.includes("past the failure"),
    "the script runs as GitHub's bash runs it: a failed command, or one in a pipe, stops it", strict.saw);

  const reached = run('echo "npm error request to https://registry.npmjs.org/a failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org"\nexit 3\n');
  ok(reached.status === 3 && mended(reached.said) && reached.said.includes('"EAI_AGAIN"') && /move its step to the part network/.test(reached.said),
    "a step that fails reaching the network keeps its status and says so, with what its output shows, and its mend", reached.saw);
  const others = [["git", "fatal: unable to access 'https://github.com/a/b/': Could not resolve host: github.com"], [".NET", "Resource temporarily unavailable (api.nuget.org:443)"], ["curl", "curl: (7) Failed to connect to 1.1.1.1 port 443: Network is unreachable"], ["Node's fetch", "TypeError: fetch failed"], ["output holding a NUL", "\\0 EAI_AGAIN"]];
  const seen = others.map(([who, line]) => [who, run(`printf '%b\\n' "${line}" >&2\nexit 1\n`)]);
  ok(seen.every(([, r]) => r.status === 1 && mended(r.said)), "and so it is where git, .NET, curl or Node's fetch words the fetch the cut refused, and where the output holds a byte that is no text", seen.filter(([, r]) => !mended(r.said)).map(([who, r]) => `${who}: ${r.said}`).join(" | "));

  const plain = run('echo "FAIL a test of its own"\nexit 2\n');
  ok(plain.status === 2 && !plain.said.includes("reached the network"), "a step that fails for any other reason keeps its status and says nothing of the network", plain.saw);

  for (const [why, env] of [["sudo asks a password", { STUB_SUDO_FAILS: "1" }], ["the loopback cannot be brought up", { STUB_IP_FAILS: "1" }]]) {
    const r = run(`touch "${marker}"\n`, env);
    ok(r.status === 1 && mended(r.said) && /could not be cut off/.test(r.said) && !fs.existsSync(marker),
      `where ${why}, the step fails, saying its mend, and its script never runs with the network up`, r.said);
  }
  const none = spawnSync("bash", [script], { encoding: "utf8", env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
  ok(none.status === 1 && mended(none.stderr), "given no script, it fails and says how it is given one", none.stderr);
  ok(fs.readdirSync(temps).length === 0, "it leaves no file of its own behind, whether the step passed, failed or never ran", fs.readdirSync(temps).join(", "));
  fs.rmSync(tmp, { recursive: true, force: true });

  // (under the cut itself, as the core's suites run each step on Linux: nothing outside answers, loopback does)
  if (process.env.CORE_OFFLINE !== "1") console.log("note this test does not run under the cut here, so whether it stands is read where the core's suites run it on Linux");
  else {
    const lookup = await dns.lookup("registry.npmjs.org").then(() => "resolved", e => e.code);
    const outside = await new Promise(resolve => { const s = net.connect({ host: "1.1.1.1", port: 443, timeout: 5000 }, () => { s.destroy(); resolve("connected"); }); s.on("error", e => resolve(e.code)); s.on("timeout", () => { s.destroy(); resolve("timeout"); }); });
    const loopback = await new Promise(resolve => { const server = net.createServer(c => c.end()).listen(0, "127.0.0.1", () => { const s = net.connect(server.address().port, "127.0.0.1", () => { s.destroy(); server.close(); resolve("connected"); }); s.on("error", e => { server.close(); resolve(e.code); }); }); });
    ok(lookup !== "resolved" && outside !== "connected" && loopback === "connected",
      "under the cut no name resolves and no address outside is reached, while loopback answers", JSON.stringify({ lookup, outside, loopback }));
    // (and the step runs as no root, with no group but its own and none to gain, and cannot reach docker's daemon,
    // whose socket would reach the network)
    const status = fs.readFileSync("/proc/self/status", "utf8");
    const docker = await new Promise(resolve => { const s = net.connect("/var/run/docker.sock", () => { s.destroy(); resolve("connected"); }); s.on("error", e => resolve(e.code)); });
    ok(process.getuid() !== 0 && process.getgroups().every(g => g === process.getgid()) && /^NoNewPrivs:\s*1$/mu.test(status) && docker !== "connected",
      "under the cut the step runs as the runner's own user, with no group but its own and no privilege to gain, and docker's socket does not answer it", JSON.stringify({ uid: process.getuid(), gid: process.getgid(), groups: process.getgroups(), noNewPrivs: /^NoNewPrivs:.*$/mu.exec(status)?.[0], docker }));
  }
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the step's shell with the network cut off`);
process.exit(failed ? 1 : 0);
