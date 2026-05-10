import { Router } from "express";
import bcrypt from "bcryptjs";

export function createAuthRouter(db) {
  const r = Router();

  r.post("/signup", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const hash = bcrypt.hashSync(password, 10);
    try {
      const info = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, hash);
      req.session.userId = info.lastInsertRowid;
      req.session.email = email;
      return res.json({ ok: true, user: { id: info.lastInsertRowid, email } });
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already registered" });
      }
      throw e;
    }
  });

  r.post("/login", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    req.session.userId = row.id;
    req.session.email = row.email;
    return res.json({ ok: true, user: { id: row.id, email: row.email } });
  });

  r.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  r.get("/me", (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    res.json({ user: { id: req.session.userId, email: req.session.email } });
  });

  return r;
}
