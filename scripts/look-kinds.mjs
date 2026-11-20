// What the scheduled look's readers (look-pulls.mjs, look-checks.mjs) and its flow (look.mjs) share: the title of each
// kind of issue it keeps, and an outsider's text made plain to quote (core archive 218).

export const TITLES = {
  idle: "Pull requests that stand idle",
  steps: "Steps of a release not done",
  labels: "Labels and openers to mend",
  missed: "The scheduled look missed a run",
  stale: "Packages gone stale",
  red: "Checks failed on the default branch",
  late: "Late review findings to answer",
  still: "The work stands still",
};

export const plain = text => String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, 200);
