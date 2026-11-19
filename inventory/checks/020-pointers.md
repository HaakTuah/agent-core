- `scripts/pointers.mjs`: fails a pointer in the rule files, to a file, a section, a numbered point, a floor rule or an
  archive item, that leads nowhere. *Runs:* any session and the runners. *Else:* lychee (offline, with Markdown's
  anchors), remark-validate-links, markdown-link-check and linkinator, each kept for Markdown's own links and dropped,
  on fact, for the rest: none reads a backticked path, a quoted section, a bold lead or "point 6". *Bugs:* 0. **Try** a
  link checker, run offline, for the form `[text](path)` and a project's own documents (with #486's group 5); **keep**
  the core's own forms: nothing fits, they are the core's. Its reading of Markdown runs on the package marked (#530,
  item 7).
