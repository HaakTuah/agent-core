# Usage

How builders spend the week's usage: work continuously, measure it, and leave the last of it to the owner. Read at the
start of every task.

- **Work continuously,** task after task. The owner's projects' building sessions share one weekly limit (core archive
  1), and keep working until about 90% of it; from there the bulk of what remains is the owner's (core archive 2).
- **Measure it:** check weekly usage with `scripts/usage.sh` at the start and after every commit. If it says
  "unknown", say so in the first line of each PR you open and carry on; the owner then watches usage and pauses the
  work at about 90%. Only the measured share counts, never the app's warning; a session that cannot read the share
  carries on (core archive 14).
- **The brake.** From about 85% of the weekly usage no new side lane opens, and open ones finish. From about 90%, take
  on no bigger task: finish the one at hand if it is nearly done, or bring it to a clean commit and a draft PR saying
  how to test it and what is left; then only small things in the main lane (a fix, a doc), with the *progress file*
  saying where you stopped.
