// A file's size as the reading-size check counts it (reading-size.mjs, beside this file; the starter kit's first
// marks, init.mjs): its bytes, without each carriage return that stands before a line feed. So a file counts the same
// on every machine: where git converts line endings on checkout (Windows, with core.autocrlf) every line lies on disk
// one byte longer than GitHub holds it, and a count of the bytes on disk would pass on GitHub and fail there, or set
// a mark there that is too high for GitHub's. A repository that stores carriage returns counts them out on every
// machine alike. Node's own modules only.
import fs from "node:fs";

// The count of a file's bytes, given as a Buffer.
export function counted(bytes) {
  let n = bytes.length;
  for (let i = bytes.indexOf(13); i >= 0; i = bytes.indexOf(13, i + 1)) if (bytes[i + 1] === 10) n--;
  return n;
}

// The count of the file at a path; 0 where there is none. What stands there and is no regular file (a device, a pipe, a
// folder, as a link may lead to) is never read: it throws, with its mend, through one descriptor opened without waiting,
// so that what is checked is what is read.
export function sizeOf(file) {
  let fd;
  try { fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0)); } catch (e) { if (e.code === "ENOENT") return 0; throw e; }
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error(`FAIL: ${JSON.stringify(String(file))} is no regular file, and is not counted. Mend: put the file itself in its place, and run the check again`);
    return counted(fs.readFileSync(fd));
  } finally { fs.closeSync(fd); }
}
