import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, uniqueNames, zipLayout } from "@/lib/zip";

const enc = new TextEncoder();

function build(files: [string, string][], lim?: number) {
  const entries = files.map(([name, body]) => ({ name, size: enc.encode(body).length, crc: crc32(enc.encode(body)) }));
  const z = zipLayout(entries, new Date(2026, 10, 12, 21, 30), lim);
  const parts = files.flatMap(([, body], i) => [z.locals[i], enc.encode(body)]);
  const all = new Uint8Array(z.total);
  let at = 0;
  for (const p of [...parts, z.tail]) { all.set(p, at); at += p.length; }
  expect(at).toBe(z.total);
  return all;
}

/** Python's zipfile reads the archive back and checks every CRC. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const f = join(mkdtempSync(join(tmpdir(), "zip-")), "a.zip");
  writeFileSync(f, bytes);
  const py = "import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))";
  return JSON.parse(execFileSync(process.platform === "win32" ? "python" : "python3", ["-c", py, f], { encoding: "utf8" }));
}

describe("zip", () => {
  it("crc32 matches the standard check value, also across chunks", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(enc.encode("6789"), crc32(enc.encode("12345")))).toBe(0xcbf43926);
  });
  const files: [string, string][] = [["Maya 01.jpg", "first photo bytes"], ["Maya 02.jpg", "second, a bit longer"], ["café.jpg", "x"]];
  it("writes a stored zip another tool opens", () => {
    expect(unzip(build(files))).toEqual(Object.fromEntries(files));
  });
  it("writes zip64 fields once sizes and offsets pass the limit", () => {
    expect(unzip(build(files, 10))).toEqual(Object.fromEntries(files));
  });
  it("keeps names unique", () => {
    expect(uniqueNames(["a.jpg", "A.jpg", "a.jpg", "x/y.jpg"])).toEqual(["a.jpg", "A (2).jpg", "a (3).jpg", "x_y.jpg"]);
  });
});
