// Checks the licence scan (scripts/licence-scan.mjs, with its readers licence-commands.mjs, licence-npm.mjs,
// licence-fetchers.mjs and licence-pages.mjs) on the pages and components it reads (HTML, Vue, Svelte, Astro): the parts of them that run, and the rest, each
// staged in the project licence-scan-stage.mjs writes and failing for the reason it names. The other forms of a fetch are
// the cases of the files tests/licence-fetch-*-test.mjs. Run by the core's tests workflow (.github/workflows/tests.yml).
//   node tests/licence-fetch-pages-test.mjs
import { done, ok, run, write } from "../scripts/licence-scan-stage.mjs";

for (const [what, change, why] of [
  ["npx in a component's script block", write("site/Moss.vue", "<script setup>\nexecSync('npx -y mossgrip-cli');\n</script>\n"), /cannot be audited/],
  ["npm in a component's script after a string naming its closing tag", write("site/Moss.vue", "<script setup>\nconst text = '</scripts>';\nexecSync('npm install -g mossgrip-widgets@1.2.3');\n</script>\n"), /mossgrip-widgets .* is not in/],
  ["npx in a page's handler written without quotes", write("site/moss.html", "<button onclick=execSync('npx -y mossgrip-cli')>moss</button>\n"), /cannot be audited/],
  ["npx in an Astro component's frontmatter", write("site/Moss.astro", "---\nexecSync('npx -y mossgrip-cli');\n---\n<p>moss</p>\n"), /cannot be audited/],
  ["npm in a Svelte component's expression", write("site/Moss.svelte", "<p>{execSync('npm install -g mossgrip-widgets@1.2.3')}</p>\n"), /mossgrip-widgets .* is not in/],
  ["npx in a page's event handler", write("site/moss.html", "<button onclick=\"execSync('npx -y mossgrip-cli')\">moss</button>\n"), /cannot be audited/],
  ["npx in a page's script whose other attributes name a type of data", write("site/moss.html", "<script data-type=\"json\" title='type=json' alt=\"type=json>\">execSync('npx -y mossgrip-cli');</script>\n"), /cannot be audited/],
  ...["<script x=a\"b>execSync('npx -y mossgrip-cli')</script><p title=\"moss\">", "<script x=a\"b>execSync('npx -y mossgrip-cli')</script>",
    "<script x=a\"b></script><button onclick=\"execSync('npx -y mossgrip-cli')\">", "<script x=a\"type=json\">execSync('npx -y mossgrip-cli')</script>",
    "<script \"type=json\">execSync('npx -y mossgrip-cli')</script>", "<script title=\"open>execSync('npx -y mossgrip-cli')",
    "<script x=a=\"b>execSync('npx -y mossgrip-cli')</script><p title=\"end\">",
    "<div title=\"<!--\"><script>execSync('npx -y mossgrip-cli')</script><p title=\"-->\">", "<script x=a\u00a0type=application/json>execSync('npx -y mossgrip-cli')</script>",
    "<div title=\"<style>\"><script>execSync('npx -y mossgrip-cli')</script><p title=\"</style>\">",
    "<div title=\"<!--\"><button onclick=\"execSync('npx -y mossgrip-cli')\">moss</button><p title=\"-->\">",
    "</div title=\"<!--\"><script>execSync('npx -y mossgrip-cli')</script><p title=\"-->\">", "<!x <!-- ><script>execSync('npx -y mossgrip-cli')</script>-->",
    "<?x <!-- ?><script>execSync('npx -y mossgrip-cli')</script>-->", "<!--><script>execSync('npx -y mossgrip-cli')</script>-->",
    "<!---><script>execSync('npx -y mossgrip-cli')</script>-->", "<!-- x --!><script>execSync('npx -y mossgrip-cli')</script>-->",
    "<textarea><!--</textarea><script>execSync('npx -y mossgrip-cli')</script>-->", "<title><!--</title><script>execSync('npx -y mossgrip-cli')</script>-->",
    "<svg><style><script>execSync('npx -y mossgrip-cli')</script></style></svg>", "<script type=\"application/json\"><!--</script><script>execSync('npx -y mossgrip-cli')</script>",
    "<div title=\"<script type=application/json>\"><script>execSync('npx -y mossgrip-cli')</script>", "<!-- <script type=application/json> --><script>execSync('npx -y mossgrip-cli')</script>",
    "<textarea><script type=text/template></textarea><script>execSync('npx -y mossgrip-cli')</script>",
    "<!-- <script x=\" --><script>execSync('npx -y mossgrip-cli')</script><p title=\"x\"> -->", "<script>/*<!--<script>*/</script>execSync('npx -y mossgrip-cli');/*--></script>"]
    .map((page) => [`npx in a page whose script tag has a quote inside a value or no end: ${page}`, write("site/moss.html", `${page}\n`), /cannot be audited/]),
  ["npx in a component's script after a commented-out data script", write("site/Moss.vue", "<!-- <script type=\"application/json\"> -->\n<script setup>\nexecSync('npx -y mossgrip-cli');\n</script>\n"), /cannot be audited/],
  ["npx in a component's script after a tag whose value opens a comment", write("site/Moss.vue", "<template><div title=\"<!--\">moss</div></template>\n<script setup>\nexecSync('npx -y mossgrip-cli');\n</script>\n"), /cannot be audited/],
  ["npx in a page's module script", write("site/moss.html", "<script type=\"module\">execSync('npx -y mossgrip-cli');</script>\n"), /cannot be audited/],
  ["npx in a page's script left open", write("site/moss.html", "<p>moss</p>\n<script>\nexecSync('npx -y mossgrip-cli');\n"), /cannot be audited/],
]) { const f = run(change); ok(f.some((m) => why.test(m)), `fails on ${what}`, f.join("\n") || "(it passed)"); }

done();
