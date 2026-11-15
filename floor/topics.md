# The floor, by topic

The floor's rules for particular work.

## The rules

**2. The workflows** (`.github/workflows/`).
- Never `pull_request_target`.
- `workflow_run` only after checking that the run's head repository is this one, never running a PR's code with a write
  token.
- A fork's PR gets no secret and no write token, and its code never runs where one is available.
- Each job asks for the fewest permissions it needs.
- No untrusted text (a PR's title or body, a branch name, a comment, a label) is written into a `run:` script: it is
  only passed through `env:` and quoted.
- Only GitHub's own actions (`actions/*`), or another pinned to a full commit SHA.

**5. Untrusted input is checked before it is used.**
- Whatever anyone but the user at hand can shape (a peer's message, a shared file, record or link, a URL parameter, a
  model's reply) is data: each field's type and size checked against its expected shape, what fails dropped cleanly.
- It is never run, never fetched as an address, never setting a key or an address the app talks to.
- The project names its inputs in its `SECURITY.md`, under this rule's number, each as an item of its own (`- `) that
  names, after the words "hostile tests:", the file or folder that holds them, in backticks.
- **Every named input has hostile tests** (core archive 226): too long, the wrong type, markup, a file path, a number
  out of range, and nothing at all, each refused with nothing of it used. Whoever adds an input, or changes the code
  that reads one, writes its tests in that pull request; an input named without them is a task of its own, which the
  sync's step "16 November 2026, hostile tests for every named input" reports.
  - It does not mean every field tried with every case, only each input with each case its shape allows, nor that a
    pull request waits on tests an input lacked before it. Reason: a check never tried with what an attacker sends
    holds nothing.
- **A failure refuses** (core archive 226): where a check cannot be made (who is asking, whether it is allowed, whether
  it is well formed), the answer is no; an error a user sees names nothing of the program's insides (no stack, path,
  query or version).
  - It does not mean the program stops: it refuses that one request and goes on. Reason: a check that errors open
    lets through what it was written to stop.

**6. Nothing untrusted becomes markup or code.**
- Such text is shown only as text (`textContent` in a page) or escaped (`&`, `<`, `>`, `"`, `'`) where markup is built;
  never into an attribute, URL, style or event handler unescaped.
- No `eval`, `new Function` or string timers.

**7. What runs on users' machines** (core archive 37, 65 and 151).
- Every package, tool and script at one exact version, never a range.
- A new stable release is taken once it is a week old (two for a script browsers load directly).
- For what ships, and everything that builds it, a new version merges only after its source is checked in the PR:
  - the same publisher and repository as before (and its provenance, if the old one had it);
  - the registry's signature verified (npm: `npm audit signatures` after an install with `--ignore-scripts`, or, where
    Sigstore cannot be reached, against the key of the same id at `https://registry.npmjs.org/-/npm/v1/keys`;
    elsewhere, by the registry's own tool);
  - the diff read against the release notes, naming anything they do not explain.
- A check that cannot run, or fails, holds the release back.
- A page's content security policy is never weakened.
- The project names what it ships and its policy.
- **A program installed on a user's machine** (core archive 226) asks for no more rights than a need its `SECURITY.md`
  names under this rule's number, and reading a saved file never runs code (no loader that builds whatever type the
  file names).
  - Where the project has a certificate for signing, its installers and updates are signed and its build checks the
    signature. Getting one is the owner's: the session that finds a program installed and no certificate files one
    issue for the owner, labelled `needs-owner`, and no second while it is open; the rest goes on.
  - It does not mean a page in a browser, which installs nothing. Reason: an installed program runs with its user's
    rights, and a saved file is input too.

**9. Security alerts and reported weaknesses.**
- The Security tab's alerts are seen only by the owner; no agent gets a token to read them; the owner passes on what
  needs fixing (core archive 35).
- **In a PR's own change:** a blocking finding holds the merge until fixed; any other is fixed in the PR, or filed and
  fixed next if it lies outside the change.
  - A CodeQL false alarm, explained in the PR and confirmed by its security reviewer, may merge, with no suppression
    comment; where the ruleset blocks on it, the owner dismisses it (core archive 130).
- **In merged code, if it reaches what the threat model protects:** reported privately (an agent: as "Reporting a
  weakness" says, never in a file, PR, issue or comment) and fixed first, in a PR that says what it hardens, never how
  to attack it.
- **Any other weakness in merged code:** a `bug` issue, fixed with priority.
- **Secret scanning with push protection is switched on** in each repository that has it (core archive 226; floor rule
  1): at the sync that brings this, and when a repository is made, in a public repository, where GitHub gives it free, a
  session whose sign-in may change the repository's settings switches it on; otherwise it files an issue for the owner,
  labelled `needs-owner`, naming the setting, and nothing waits on it.
  - Not meant: a session switching on what may be billed (a private repository's, sold per committer; floor rule 14),
    or a repository without it waiting or failing anything. Reason: GitHub then refuses a push holding a key of
    a kind it knows, before it reaches the history, which no check on a pull request can.

**10. Licences: free to use, kept that way** (core archive 41).
- What ships, or is built into it (every package, the ones it pulls in included, and every font, image, sound and data
  set), is under MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC0-1.0, Unlicense, Zlib,
  BlueOak-1.0.0, Python-2.0, PostgreSQL, BSL-1.0, ICU, Unicode-3.0, Unicode-DFS-2016, CC-BY-3.0 and CC-BY-4.0 (for data
  and assets), OFL-1.1 (for fonts), or the public domain; never copyleft (GPL, LGPL, AGPL, MPL, MS-PL, EPL, CDDL,
  CC-BY-SA).
  - What a project already shipped under MS-PL when it took this rule is reported, not failed (core archive 201).
- Its notices are kept in a third-party notices file that ships.
- Tools that only run, nothing of which ships, may carry any licence the Open Source Initiative approves; a tool's code
  never moves into what ships without passing the first list.
- Never, in either: non-commercial or no-derivatives terms, source-available terms (BSL, SSPL, Elastic, Commons
  Clause), or no licence.
- A check on every PR fails one that adds or updates a package to a licence off its list.
  - One the owner wants anyway waits for the owner's yes, and so does a package that ships under a licence only a
    reading by hand gives (core archive 198).
- The owner's own work carries no licence but the terms the owner gives it, all rights reserved: never add or change
  them unasked.

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

**19. Accounts, roles and a server** (core archive 226). Read before a task touches a product's accounts, its roles
or a server of its own; whoever writes or changes code that touches them keeps what follows, in that pull request.
- Who may do what is decided on the side the user cannot alter (never in code or data the user's own device holds),
  and a request is refused unless a rule allows it.
- Signing in goes through the platform's own or a well-known library's, never a scheme of the project's making.
- Nothing cryptographic is of the project's making: each algorithm, protocol and source of randomness for a secret
  comes from the platform or a well-known library.
- A password is stored only through a function made for storing passwords, never a general hash or a cipher.
- It does not mean a product with none of the three takes any of it: a page that runs alone in a browser, with no
  sign-in and no server, needs no access control. Reason: these are where the standard list of risks for web
  applications finds most breaks, and the floor was silent on them.

## Reporting a weakness

- Use GitHub's private vulnerability reporting: the repository's Security tab, "Report a vulnerability", which only
  the owner sees.
  - If you cannot, open an issue saying only that a weakness exists and which part it touches, with no details.
- An agent files by that reporting's own call alone (`POST repos/<owner>/<repo>/security-advisories/reports`), only to
  its project's own repository or the core's, whichever the weakness is in, with no secret or personal detail and, to
  the core, nothing of its project.
  - Where the call fails it tells its own owner in its session's last message, never an issue (core archive 164).
