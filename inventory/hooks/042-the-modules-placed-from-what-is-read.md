- `scripts/step-checks-modules.mjs`: the checks of the steps that place the modules a project's manifest neither takes
  nor leaves out (steps 160, 470, 480 and 500), from what `scripts/manifest-reads.mjs` reads exactly, and of the step
  that asks the owner to confirm those taken by choice (#1094). *Runs:* any session, in the project, from the sync's
  steps. *Else:* none sought apart: it is a part of the steps (`040-init.md`), whose search stands for it. *Bugs:* none.
  **Keep:** nothing fits; which of the core's modules a project takes is the core's to read.
