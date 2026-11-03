import { Router, type IRouter } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const bags = new Set(["the-sloane", "the-solenne", "the-marais", "the-no-8", "the-alba", "the-liora"]);

router.get("/:bag/:frame", async (req, res) => {
  const { bag, frame } = req.params;
  if (!bags.has(bag) || !/^(0[1-9]|1[0-9]|2[0-4])\.jpg$/.test(frame)) {
    res.status(404).json({ error: "Frame not found" });
    return;
  }
  try {
    const file = await storage.searchPublicObject(`assets/products/${bag}/${frame}`);
    if (!file) {
      res.status(404).json({ error: "Frame not found" });
      return;
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const stream = file.createReadStream();
    res.on("close", () => stream.destroy());
    stream.on("error", (error) => {
      req.log.error({ err: error, bag, frame }, "Product frame stream failed");
      if (!res.headersSent) res.status(503).json({ error: "Frame temporarily unavailable" });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    req.log.error({ err: error, bag, frame }, "Product frame unavailable");
    res.status(503).json({ error: "Frame temporarily unavailable" });
  }
});

export default router;
