// Checks the whole job of the NuGet check, .github/workflows/nuget.yml (tests/nuget-gate-test.mjs holds its other steps),
// where its restore must succeed: on a project with no package, a project file changed, the restore runs from the lock
// file and the check passes, every package's licence read before the restore. Every restore names NuGet's own registry
// as a source (scripts/nuget.mjs), and NuGet loads a source's service index even where the project asks it for no
// package, so with the network cut off the restore fails (NU1301): the case is here, in the part network (tasks/tests.md,
// "A test that reaches the network runs once per batch"; #772). Where there is no .NET SDK (never on GitHub's runners) it
// is left out. On Linux and on Windows. Git, the .NET SDK, npm and Node's own modules.
//
//   node tests/nuget-gate-network-test.mjs
import { nugetScratch } from "../scripts/nuget-gate-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { sdk, project, whole } = nugetScratch("nuget-gate-network-test-");
ok(sdk || !process.env.GITHUB_ACTIONS, "on GitHub's runners there is a .NET SDK, so the whole job is run here as there");
if (!sdk) console.log("skip the whole job: no .NET SDK here");
else {
  const good = whole({ "src/App/App.csproj": project("").replace(/  <ItemGroup>[\s\S]*?<\/ItemGroup>\n/, "").replace("</Project>", "  <!-- a note -->\n</Project>") });
  ok(good.passed && good.ran.includes("Restore each project file from its lock file alone") && good.ran.includes("Every package one exact version, and under a licence on its list"), "the whole job: a project file changed, the restore runs from the lock file and the check passes", good.out.slice(-1400));
  const FETCH = "Every locked package and tool, fetched before the restore and held to its list";
  ok(good.ran.indexOf(FETCH) >= 0 && good.ran.indexOf(FETCH) < good.ran.indexOf("Restore each project file from its lock file alone"), "and every package's licence is read before the restore, which runs the pull request's build files", good.ran.join(" | "));
}

done("the NuGet check's whole job, its restore");
