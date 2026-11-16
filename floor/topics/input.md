# The floor, by topic: untrusted input

Read before a task touches what anyone but the user at hand can shape, and by a security review: the kinds `input` and
`security-review`.

**5. Untrusted input is checked before it is used.**
- Whatever anyone but the user at hand can shape (a peer's message, a shared file, record or link, a URL parameter, a
  model's reply) is data: each field's type and size checked against its expected shape, what fails dropped cleanly.
- It is never run, never fetched as an address, never setting a key or an address the app talks to.
- The project names its inputs in its `SECURITY.md`, under this rule's number, each as an item of its own (`- `) that
  names, after the words "hostile tests:", the file or folder that holds them, in backticks.
- **Every named input has hostile tests:** too long, the wrong type, markup, a file path, a number
  out of range, and nothing at all, each refused with nothing of it used. Whoever adds an input, or changes the code
  that reads one, writes its tests in that pull request; an input named without them is a task of its own, which the
  sync's step "16 November 2026, hostile tests for every named input" reports.
  - It does not mean every field tried with every case, only each input with each case its shape allows, nor that a
    pull request waits on tests an input lacked before it. Reason: a check never tried with what an attacker sends
    holds nothing.
- **A failure refuses:** where a check cannot be made (who is asking, whether it is allowed, whether
  it is well formed), the answer is no; an error a user sees names nothing of the program's insides (no stack, path,
  query or version).
  - It does not mean the program stops: it refuses that one request and goes on. Reason: a check that errors open
    lets through what it was written to stop.

**6. Nothing untrusted becomes markup or code.**
- Such text is shown only as text (`textContent` in a page) or escaped (`&`, `<`, `>`, `"`, `'`) where markup is built;
  never into an attribute, URL, style or event handler unescaped.
- No `eval`, `new Function` or string timers.
