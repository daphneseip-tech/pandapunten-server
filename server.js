// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Path naar users.json
const USERS_FILE = path.join(__dirname, "users.json");

// Helpers
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, "utf8");
  return JSON.parse(data || "[]");
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Bereken pandapunten (weken sinds laatste reset)
function getPandapunten(user) {
  const lastReset = new Date(user.last_reset);
  const now = new Date();
  const diffMs = now - lastReset;
  const diffWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
  return diffWeeks;
}

// Routes
app.get("/api/users", (req, res) => {
  const users = readUsers().map(u => ({
    name: u.name,
    token: u.token,
    pandapunten: getPandapunten(u),
    last_reset: u.last_reset
  }));
  res.json(users);
});

// Admin middleware
function checkAdmin(req, res, next) {
  const adminToken = req.headers["x-admin-token"];
  if (adminToken !== "39f90f0a9ab0145b") {
    return res.status(403).json({ error: "Alleen admin mag dit doen" });
  }
  next();
}

// Voeg gebruiker toe
app.post("/api/users", checkAdmin, (req, res) => {
  const { name, startDate } = req.body;
  if (!name || !startDate) return res.status(400).json({ error: "Naam en startdatum verplicht" });

  const users = readUsers();
  // genereer simpele token (UUID kan ook)
  const token = Math.random().toString(36).substring(2, 12);
  users.push({ name, token, last_reset: startDate });
  writeUsers(users);

  res.json({ ok: true, token });
});

// Verwijder gebruiker
app.delete("/api/users/:token", checkAdmin, (req, res) => {
  const token = req.params.token;
  let users = readUsers();
  const beforeCount = users.length;
  users = users.filter(u => u.token !== token);
  writeUsers(users);

  if (users.length === beforeCount) return res.status(404).json({ error: "Gebruiker niet gevonden" });
  res.json({ ok: true, message: "Gebruiker verwijderd" });
});

// Pas resetdatum aan
app.put("/api/users/:token/resetdate", checkAdmin, (req, res) => {
  const token = req.params.token;
  const { newDate } = req.body;
  if (!newDate) return res.status(400).json({ error: "Nieuwe datum verplicht" });

  const users = readUsers();
  const user = users.find(u => u.token === token);
  if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });

  user.last_reset = newDate;
  writeUsers(users);

  res.json({ ok: true, message: "Resetdatum aangepast" });
});

// Reset eigen pandapunten
app.post("/api/reset", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token verplicht" });

  const users = readUsers();
  const user = users.find(u => u.token === token);
  if (!user) return res.status(404).json({ error: "Token ongeldig" });

  user.last_reset = new Date().toISOString();
  writeUsers(users);

  res.json({ ok: true, message: "Reset succesvol" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});
