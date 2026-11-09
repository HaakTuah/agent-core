# Usage

How builders spend the week's usage: continuously, every provider to its end but Claude, whose last tenth is the
owner's, measured where it can be. Read at the start of every task.

- **Work continuously,** task after task (core archive 1 and 2).
- **Claude keeps the owner's share** (floor rule 16): its weekly limit is shared with the owner's own work and with
  every project. **The brake:** from about 85% of it no new side lane opens, and open ones finish; from about 90%, no
  bigger task: finish the one at hand if nearly done, or bring it to a clean commit and a draft PR saying what is left;
  then only small things in the main lane, the *progress file* saying where you stopped. Only the measured share
  counts, never the app's warning (core archive 14).
- **Every other provider is spent to its end** (floor rule 16; core archive 76). Where an environment can read every
  provider's usage (a machine of the owner's, a server, a tool that starts agents and reads their usage), the
  orchestrator spreads the work so each of them is spent by its weekly reset before Claude reaches 90%.
- **Measure it** with `scripts/usage.sh` at the start and, where it can read it, after every commit. Where it cannot
  (a cloud session today), it says so at the start; then check no more, and say nothing about it in any PR, report or
  message: the owner watches and pauses the work at about 90% (core archive 76).
