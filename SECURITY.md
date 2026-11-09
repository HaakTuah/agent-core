# Security

This repository takes the floor whole: `floor/security.md`, rules 1 to 13, with its threat model,
`floor/threat-model.md`. What this repository adds under the floor's numbers:

- **Rule 3, the protected files:** every file here. The trusted builder: Claude's sessions the owner starts in this
  repository.
- **Rules 4, 5, 7 and 10:** none. The repository holds documents and one workflow, ships nothing, takes no package and
  has no Dependabot exception.
- **The threat model's part:** the core has no users of its own; what an attacker would want of it is a rule loosened
  here that every project then takes, so a change reaches a project only through a reviewed sync PR there.

## Reporting a weakness

"Reporting a weakness" in `floor/security.md`: privately, through the Security tab's "Report a vulnerability".
