import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  getS3Client,
  getBucket,
  userPrefix,
  sanitizeRelativeKey,
  putObject,
  listUserObjects,
  deleteObjectKey,
} from "../s3.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024, files: 500 },
});

export function createFilesRouter() {
  const r = Router();
  r.use(requireAuth);

  r.get("/list", async (req, res, next) => {
    try {
      const items = await listUserObjects(req.session.userId);
      const prefix = userPrefix(req.session.userId);
      const mapped = items.map((o) => ({
        key: o.key,
        relativePath: o.key.slice(prefix.length),
        size: o.size,
        lastModified: o.lastModified,
      }));
      res.json({ files: mapped });
    } catch (e) {
      next(e);
    }
  });

  r.post("/upload", upload.array("files", 500), async (req, res, next) => {
    try {
      const userId = req.session.userId;
      const prefix = userPrefix(userId);
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ error: "No files" });
      }

      const uploaded = [];
      for (const f of files) {
        const rel = sanitizeRelativeKey(f.originalname);
        const key = `${prefix}${rel}`;
        await putObject(key, f.buffer, f.mimetype || "application/octet-stream");
        uploaded.push({ key, relativePath: rel, size: f.size });
      }
      res.json({ ok: true, uploaded });
    } catch (e) {
      next(e);
    }
  });

  r.get("/download", async (req, res, next) => {
    try {
      const key = String(req.query.key || "");
      const prefix = userPrefix(req.session.userId);
      if (!key.startsWith(prefix)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const client = getS3Client();
      const out = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
      const filename = key.slice(prefix.length).split("/").pop() || "download";
      res.setHeader("Content-Type", out.ContentType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      if (out.ContentLength != null) res.setHeader("Content-Length", String(out.ContentLength));
      out.Body.pipe(res);
    } catch (e) {
      next(e);
    }
  });

  r.delete("/object", async (req, res, next) => {
    try {
      const key = String(req.body?.key || "");
      const prefix = userPrefix(req.session.userId);
      if (!key.startsWith(prefix)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await deleteObjectKey(key);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
