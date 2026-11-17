// A zip file's entries, read from its central directory, and one entry's bytes: what the NuGet check reads of a package
// file (nuget-fetch.mjs) and the code scan of a wheel of its engine (code-scan.mjs). Only the plain form: a zip of the
// 64-bit form, an entry packed by any method but stored (0) or deflated (8), and an entry that inflates past the bound
// given are refused, with an error that says which. Node's own modules only.
//
//   import { zipEntries, zipRead } from "./zip.mjs";
import { inflateRawSync } from "node:zlib";

/** Each entry of a zip held in a buffer, in the directory's order: { name, method, size, packed, local }. */
export function zipEntries(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]), Math.max(0, zip.length - 22));
  if (end < 0 || zip.length - end > 22 + 65535) throw new Error("no zip's end of directory");
  const entries = zip.readUInt16LE(end + 10), dirAt = zip.readUInt32LE(end + 16);
  if (entries === 0xffff || dirAt === 0xffffffff) throw new Error("a zip of the 64-bit form, which this does not read");
  const found = [];
  for (let at = dirAt, i = 0; i < entries; i++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== 0x02014b50) throw new Error("a zip whose directory this does not read");
    const method = zip.readUInt16LE(at + 10), packed = zip.readUInt32LE(at + 20), size = zip.readUInt32LE(at + 24);
    const nameLen = zip.readUInt16LE(at + 28), extraLen = zip.readUInt16LE(at + 30), commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    found.push({ name: zip.subarray(at + 46, at + 46 + nameLen).toString("utf8"), method, size, packed, local });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return found;
}

/** One entry's bytes, inflated to at most `most` bytes; throws where it cannot be read so. */
export function zipRead(zip, { method, packed, local }, most) {
  if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) throw new Error("a zip whose entry this does not read");
  const from = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(from, from + packed);
  if (method === 0) {
    if (data.length > most) throw new Error(`an entry larger than ${most} bytes`);
    return data;
  }
  if (method === 8) return inflateRawSync(data, { maxOutputLength: most });
  throw new Error(`an entry packed in a way this does not read (method ${method})`);
}
