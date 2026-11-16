# The floor, by topic: dependencies

Read before a task adds or updates a dependency or a tool of an agent's own, and by a security review: the kinds
`dependency`, `update`, `tool` and `security-review`; the paths `.github/dependabot.yml`, `.node-version`, `*.lock`,
`*.lockb`, `*.lock.json`, `*-lock.json`, `*-lock.yaml`, `*-shrinkwrap.json` and `go.sum`.

**15. Dependencies** (core archive 76).
- Installed from the lock file (`npm ci` or its like), except where a PR adds or updates a package.
- Never running a package's install scripts.
- Pinned as rule 7 says.
- A new one only with a reason, from a known publisher.
- Findings from CI's audit fixed, not silenced.
- **An agent's own tools are code with its sign-ins** (core archive 225): every plug-in, tool server, skill and hook the
  project configures for its agents is listed under "agentTools" in its licence check's config, from a known
  publisher, a plug-in or tool server at one exact version (a skill or hook is pinned by the project's commit, and
  names the version of anything else it runs); the starter kit's hooks are the core's, listed by it.
  - A session adds none, in the project or outside it, but where its task or the owner's word names it, listing one
    the project configures in the same PR; never by its own choice.
  - It does not mean how a machine is set up for agents, which is the owner's (floor rule 18), nor what a provider
    loads outside the project. Reason: a tool an agent loads runs with the session's sign-ins.

**17. Dependabot's own PRs** (core archive 34).
- One merges only if `dependabot[bot]` opened it from a branch in this repository, it changes only the manifests and
  lock files the project names (or an action's pinned version), and it passes the review, the release notes read and
  rule 7's source check, with the checks green.
- One that fails a condition is closed with the reason, and the update made in a PR of the builder's own.
