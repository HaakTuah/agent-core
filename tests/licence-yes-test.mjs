// Checks the owner's yes of the licence check (licence-yes.mjs) on the staged project (licence-scan-stage.mjs): a package
// or an audit entry off its list passes only by it, and never further. The scan's other cases are licence-scan-test.mjs's.
// Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/licence-yes-test.mjs
import { LOCK, done, entry, json, asOutput, ok, run, write } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";

// The owner's yes (licence-yes.mjs): a package or an audit entry off its list passes only by it, and never further.
{
  const said = "the owner, 13 November 2026: take it";
  const yes = (more = {}) => ({ package: "mossgrip-lib@1.0.0", licence: "LGPL-3.0-only", ships: true, yes: said, notice: "Mossgrip, LGPL 3.0.", ...more });
  const shipped = (license, accepted) => (dir) => { LOCK(license)(dir); json("licences.json", (j) => { j.ships = ["package.json"]; if (accepted) j.accepted = accepted; })(dir); };
  const paid = { name: "Bark pack", kind: "asset", licence: "LicenseRef-Vendor-EULA", ships: true, files: ["site/audio/"], notice: "Bark pack, bought." };
  const ours = (more = {}) => ({ entry: "Bark pack", licence: "LicenseRef-Vendor-EULA", ships: true, yes: said, ...more });
  const bought = (accepted, e = paid) => (dir) => { json("audit.json", (j) => { j.entries = j.entries.filter((x) => x.name !== "Bark sounds").concat(e); })(dir); json("licences.json", (j) => { j.accepted = accepted; })(dir); };
  const bare = shipped("LGPL-3.0-only");
  for (const [what, change] of [
    ["a shipped package under LGPL, with the owner's yes for that version and its notice", shipped("LGPL-3.0-only", [yes()])],
    ["a shipped package whose lockfile names no licence, read by hand and bought", shipped(undefined, [yes({ licence: "LicenseRef-Vendor-EULA" })])],
    ["a tool that only runs under terms off the tools' list, accepted as a tool, with no notice", (dir) => { LOCK("LicenseRef-Vendor-EULA")(dir); json("licences.json", (j) => { j.accepted = [yes({ licence: "LicenseRef-Vendor-EULA", ships: false, notice: undefined })]; })(dir); }],
    ["an audit entry that was bought, with the owner's yes", bought([ours()])],
    ["a tool a script installs, off the tools' list, with the owner's yes for its version", (dir) => { json("audit.json", (j) => { j.entries.find((x) => x.name === "mossgrip-cli").licence = "LicenseRef-Vendor-EULA"; })(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "mossgrip-cli", version: "1.2.3", ships: false })]; })(dir); }],
    ["a yes whose licence is a whole expression", shipped(undefined, [yes({ licence: "LicenseRef-A AND (MIT OR LGPL-3.0-only)" })])],
    ["a bought package whose own fields name no licence but say UNLICENSED, read by hand", shipped("UNLICENSED", [yes({ licence: "LicenseRef-Vendor-EULA" })])],
  ]) { const f = run(change); ok(f.length === 0, `passes ${what}`, f.join("\n")); }
  for (const [what, change, why] of [
    ["a shipped package under LGPL with no yes, and says where one goes", bare, /off the list for what ships: mossgrip-lib@1\.0\.0 \(LGPL-3\.0-only\).*Mend: .*goes in the config's "accepted"/],
    ["a yes for another version", shipped("LGPL-3.0-only", [yes({ package: "mossgrip-lib@1.0.1" })]), /off the list for what ships: mossgrip-lib@1\.0\.0/],
    ["a yes that nothing installs", shipped("LGPL-3.0-only", [yes(), yes({ package: "mossgrip-old@2.0.0" })]), /"accepted" names mossgrip-old@2\.0\.0, which nothing installs\. Mend: take that yes out of "accepted"/],
    ["a yes for what is on its list", shipped("MIT", [yes({ licence: "MIT" })]), /which is on its list and needs no yes\. Mend: take that yes out/],
    ["a yes for a tool, where it ships", shipped("LGPL-3.0-only", [yes({ ships: false })]), /a yes for a tool is no yes for what ships/],
    ["a yes for what ships with no notice", shipped("LGPL-3.0-only", [yes({ notice: " " })]), /its notice ships too.*Mend: give its yes in "accepted" its "notice"/],
    ["a yes under non-commercial terms, by the yes", shipped(undefined, [yes({ licence: "CC-BY-NC-4.0" })]), /accepted, and under CC-BY-NC-4\.0, terms floor rule 10 never allows/],
    ["a yes under source-available terms, by the lockfile", shipped("BUSL-1.1", [yes()]), /accepted, and under BUSL-1\.1, terms floor rule 10 never allows/],
    ["a package under terms the floor never allows, with no word of a yes", shipped("SSPL-1.0"), /^off the list for what ships: mossgrip-lib@1\.0\.0 \(SSPL-1\.0\), in package-lock\.json\. Mend: replace it with a package under a licence on that list; floor rule 10 never takes these terms in$/],
    ["a yes with no words of the owner's", shipped("LGPL-3.0-only", [yes({ yes: " " })]), /"accepted" is not in the form it reads\. Mend: write it as a list of/],
    ["a yes with a key it does not know", shipped("LGPL-3.0-only", [yes({ why: "needed" })]), /"accepted" is not in the form it reads/],
    ["a yes naming a package with no version", shipped("LGPL-3.0-only", [yes({ package: "mossgrip-lib" })]), /"accepted" is not in the form it reads/],
    ["a yes given twice", shipped("LGPL-3.0-only", [yes(), yes()]), /names one twice: package mossgrip-lib@1\.0\.0/],
    ["a yes for a package that comes from elsewhere than the registry", (dir) => { shipped("LGPL-3.0-only", [yes()])(dir); json("package-lock.json", (j) => { j.packages["node_modules/mossgrip-lib"].resolved = "https://mossgrip.example/mossgrip-lib/-/mossgrip-lib-1.0.0.tgz"; })(dir); }, /off the list for what ships: mossgrip-lib@1\.0\.0/],
    ...["AND", "MIT AND", "see the vendor's page"].map((words) => [`a yes whose licence reads "${words}", which is no whole expression`, shipped(undefined, [yes({ licence: words })]), /which no machine can read/]),
    ...["PolyForm-Noncommercial-1.0.0", "FSL-1.1-MIT", "BSL-1.1", "MIT + Commons Clause", "LicenseRef-NonCommercial", { type: "BUSL-1.1" }, ["SSPL-1.0"]].map((l) => [`a yes for a package whose lockfile says ${JSON.stringify(l)}`, shipped(l, [yes({ licence: "LicenseRef-Vendor-EULA" })]), /accepted, and under .*, terms floor rule 10 never allows/]),
    ["a yes under source-available terms by a name the owner gave", shipped(undefined, [yes({ licence: "LicenseRef-Business-Source" })]), /accepted, and under LicenseRef-Business-Source, terms floor rule 10 never allows/],
    ["a yes for a version the lockfile claims and its registry address does not", (dir) => { shipped("LGPL-3.0-only", [yes()])(dir); json("package-lock.json", (j) => { j.packages["node_modules/mossgrip-lib"].resolved = "https://registry.npmjs.org/mossgrip-lib/-/mossgrip-lib-2.0.0.tgz"; })(dir); }, /off the list for what ships: mossgrip-lib@1\.0\.0/],
    ["a yes that names another licence than the lockfile's", shipped("LGPL-3.0-only", [yes({ licence: "MIT" })]), /accepted under MIT, and recorded as under LGPL-3\.0-only, and another licence is another yes\. Mend: /],
    ["a bought audit entry with no yes", bought(undefined), /Bark pack: LicenseRef-Vendor-EULA is not on the list for what ships/],
    ["a yes for an audit entry the audit does not hold", bought([ours(), ours({ entry: "Moss pack" })]), /names the audit entry Moss pack, which the audit does not hold\. Mend: take that yes out/],
    ["a yes for an audit entry on its list", (dir) => json("licences.json", (j) => { j.accepted = [ours({ entry: "Bark sounds", licence: "CC0-1.0" })]; })(dir), /the audit entry Bark sounds, which is on its list and needs no yes/],
    ["a yes for an audit entry under no-derivatives terms", bought([ours({ licence: "CC-BY-ND-4.0" })], { ...paid, licence: "CC-BY-ND-4.0" }), /accepted, and under CC-BY-ND-4\.0, terms floor rule 10 never allows/],
    ["a yes for an audit entry under no-derivatives terms by a name the owner gave", bought([ours({ licence: "LicenseRef-NoDerivatives" })], { ...paid, licence: "LicenseRef-NoDerivatives" }), /accepted, and under LicenseRef-NoDerivatives, terms floor rule 10 never allows/],
    ["a yes for an audit entry whose licence no machine can read", bought([ours({ licence: "bought from the vendor" })], { ...paid, licence: "bought from the vendor" }), /which no machine can read/],
    ["an audit entry accepted as a tool, once it ships", bought([ours({ ships: false })]), /Bark pack: accepted as a tool that only runs .*a yes for a tool is no yes for what ships/],
    ["an audit entry accepted under one licence, once the audit records another", bought([ours()], { ...paid, licence: "LicenseRef-Vendor-EULA-2" }), /accepted under LicenseRef-Vendor-EULA, and recorded as under LicenseRef-Vendor-EULA-2, and another licence is another yes/],
    ["an audit entry accepted at one version, once the audit and the script move to the next", (dir) => { json("audit.json", (j) => { Object.assign(j.entries.find((x) => x.name === "mossgrip-cli"), { licence: "LicenseRef-Vendor-EULA", version: "2.0.0" }); })(dir); write("scripts/setup.sh", "npm install -g mossgrip-cli@2.0.0\nnpx --no-install vitest run\nnpm ci\n")(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "mossgrip-cli", version: "1.2.3", ships: false })]; })(dir); }, /mossgrip-cli: LicenseRef-Vendor-EULA is not on the list for tools that only run/],
    ["a yes with no version for an audit entry that has one", (dir) => { json("audit.json", (j) => { j.entries.find((x) => x.name === "mossgrip-cli").licence = "LicenseRef-Vendor-EULA"; })(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "mossgrip-cli", ships: false })]; })(dir); }, /names the audit entry mossgrip-cli, which the audit does not hold\. Mend: take that yes out/],
    ["an accepted audit entry that ships without its notice", bought([ours()], { ...paid, notice: "" }), /Bark pack: it ships, so its notice ships too/],
    ["a yes in \"accepted\" for a NuGet package's audit entry", (dir) => { entry({ name: "Odd.Pkg@1.0.0", kind: "nuget", licence: "LGPL-3.0-only", ships: true, notice: "Odd, LGPL 3.0." })(dir); json("licences.json", (j) => { j.accepted = [ours({ entry: "Odd.Pkg@1.0.0", licence: "LGPL-3.0-only" })]; })(dir); }, /a NuGet package's yes stands in "nuget\.accepted", never in "accepted"/],
    ["a yes for an audit entry that says nothing of its licence or whether it ships", bought([{ entry: "Bark pack", yes: said }]), /"accepted" is not in the form it reads/],
    ["a yes for an audit entry given twice", bought([ours(), ours()]), /names one twice: entry Bark pack/],
    ["a yes for an audit entry in a config with no audit", (dir) => { LOCK("MIT")(dir); json("licences.json", (j) => { delete j.audit; delete j.scan; j.accepted = [ours()]; })(dir); }, /names an audit entry, and the config names no "audit"/],
  ]) { const f = run(change); ok(f.some((m) => why.test(m)) && mended(asOutput(f)), `fails on ${what}, each failure saying its mend`, f.join("\n") || "(it passed)"); }
  const twice = run((dir) => { shipped("LGPL-3.0-only", [yes({ ships: false })])(dir); json("package-lock.json", (j) => { j.packages["node_modules/bark-x/node_modules/mossgrip-lib"] = { ...j.packages["node_modules/mossgrip-lib"] }; j.packages["node_modules/bark-x"] = { version: "1.0.0", resolved: "https://registry.npmjs.org/bark-x/-/bark-x-1.0.0.tgz", license: "MIT", dependencies: { "mossgrip-lib": "1.0.0" } }; j.packages[""].dependencies["bark-x"] = "1.0.0"; })(dir); write("package.json", JSON.stringify({ name: "bark", dependencies: { "mossgrip-lib": "1.0.0", "bark-x": "1.0.0" } }))(dir); });
  ok(twice.length === 1, "a package a lockfile holds twice fails once", twice.join("\n"));
}

done();
