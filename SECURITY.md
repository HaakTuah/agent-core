# Security

This repository takes the floor whole: `floor/security.md` and `floor/topics.md`, rules 1 to 17, with its threat model,
`floor/threat-model.md`. What this repository adds under the floor's numbers:

- **Rule 3, the protected files:** every file here. The trusted builder: Claude's sessions the owner starts in this
  repository.
- **Rule 11:** the check is `.github/workflows/personal-terms.yml`, as in the games; its "SECURITY.md, point 11" is
  floor rule 11.
- **Rules 5, 6, 7, 10 and 15:** none. The repository holds documents and one workflow, ships nothing and takes no
  package. **Rule 17:** Dependabot updates only that workflow's GitHub actions (`.github/dependabot.yml`), under rule
  3's narrow exception, into `main` (this repository has no `develop`); this repository names no manifest or lock file,
  so no security PR of Dependabot's meets it.
- **The threat model's part:** the core has no users of its own; what an attacker would want of it is a rule loosened
  here that every project then takes, so a change reaches a project only through a reviewed sync PR there.

## Reporting a weakness

"Reporting a weakness" in `floor/topics.md`: privately, through the Security tab's "Report a vulnerability".
