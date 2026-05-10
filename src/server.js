import "./preload.js";
import express from "express";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";
import { createAuthRouter } from "./routes/auth.js";
import { createFilesRouter } from "./routes/files.js";
import { ensureBucketReachable } from "./s3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
const db = getDb();

app.use(express.json());
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", createAuthRouter(db));
app.use("/api/files", createFilesRouter());

app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

const port = Number(process.env.PORT) || 3000;

async function main() {
  await ensureBucketReachable().catch((e) => {
    console.error(
      "[S3] Cannot reach bucket. Check RustFS is running and .env (S3_ENDPOINT, S3_BUCKET, keys).",
      e.message
    );
    process.exit(1);
  });
  app.listen(port, () => {
    console.log(`http://127.0.0.1:${port}`);
  });
}

main();
