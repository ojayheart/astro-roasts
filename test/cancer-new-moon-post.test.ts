import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";

const outputDir = join(
  process.cwd(),
  "public",
  "ig",
  "cancer-new-moon-2026",
);

test("Cancer New Moon carousel renders eight square Instagram slides", async () => {
  const files = (await readdir(outputDir))
    .filter((file) => /^\d{2}\.jpg$/.test(file))
    .sort();

  assert.deepEqual(files, [
    "01.jpg",
    "02.jpg",
    "03.jpg",
    "04.jpg",
    "05.jpg",
    "06.jpg",
    "07.jpg",
    "08.jpg",
  ]);

  for (const file of files) {
    const metadata = await sharp(join(outputDir, file)).metadata();
    assert.equal(metadata.width, 1080, `${file} width`);
    assert.equal(metadata.height, 1080, `${file} height`);
    assert.equal(metadata.format, "jpeg", `${file} format`);
  }
});
