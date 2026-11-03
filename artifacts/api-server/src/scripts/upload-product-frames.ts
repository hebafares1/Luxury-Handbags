import { access } from "node:fs/promises";
import path from "node:path";
import { objectStorageClient, ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const allowed = new Set(["the-sloane", "the-solenne", "the-marais", "the-no-8", "the-alba", "the-liora"]);
const bags = process.argv.slice(2);
if (!bags.length || bags.some((bag) => !allowed.has(bag))) {
  throw new Error("Pass one or more valid product slugs");
}
const publicRoot = new ObjectStorageService().getPublicObjectSearchPaths()[0].replace(/^\/+/, "");
const separator = publicRoot.indexOf("/");
if (separator < 1) throw new Error("Public storage root is invalid");
const bucket = objectStorageClient.bucket(publicRoot.slice(0, separator));
const prefix = publicRoot.slice(separator + 1).replace(/\/+$/, "");
const sourceRoot = path.resolve(import.meta.dirname, "../../../../generated-artifacts/turntables");

for (const bag of bags) {
  const files = Array.from({ length: 24 }, (_, index) => `${String(index + 1).padStart(2, "0")}.jpg`);
  await Promise.all(files.map((file) => access(path.join(sourceRoot, bag, file))));
  for (let offset = 0; offset < files.length; offset += 6) {
    await Promise.all(files.slice(offset, offset + 6).map(async (file) => {
      await bucket.upload(path.join(sourceRoot, bag, file), {
        destination: `${prefix}/assets/products/${bag}/${file}`,
        resumable: false,
        metadata: { contentType: "image/jpeg", cacheControl: "public,max-age=3600" },
      });
    }));
  }
  logger.info({ bag, frames: files.length }, "Uploaded product sequence");
}
