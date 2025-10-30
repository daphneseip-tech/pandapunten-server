// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Beheerder-token
const ADMIN_TOKEN = "39f90f0a9ab0145b";

// Simpele "database" in JSON
const DATA_FILE = "./users.json";

// Helper functies
function loadUsers() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]");
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE);
    return JSON.parse(raw);
  } catch (err) {
    console.error("Fout bij het lezen van users.json:", err);
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Fout bij opslaan users.json:", err);
  }
}


function generateToken() {
  return Math.random().toString(36).substring(2,12) + Math.random().toString(36).substring(2,12);
}

// Punten berekenen (weken sinds last_reset)
function updatePandapunten(users){
  const now = new Date();
  return users.map(u => {
    const diff = now - new Date(u.last_reset);
    u.pandapunten = Math.floor(diff / (7*24*60*60*1000)); // 1 punt per week
    return u;
  });
}

// Routes

// Alle gebruikers ophalen
app.get("/api/users", (req,res)=>{
  let users = loadUsers();
  users = updatePandapunten(users);
  saveUsers(users);
  res.json(users);
});

// Nieuwe gebruiker toevoegen (admin)
app.post("/api/users", (req,res)=>{
  const adminToken = req.header("x-admin-token");
  if(adminToken !== ADMIN_TOKEN) return res.status(403).json({error:"Alleen beheerder kan toevoegen"});

  const {name, startDate} = req.body;
  const users = loadUsers();

  const token = generateToken();
  const last_reset = startDate ? new Date(startDate) : new Date();
  const pandapunten = 0;

  const newUser = {name, token, last_reset, pandapunten};
  users.push(newUser);
  saveUsers(users);
  res.json(newUser);
});

// Gebruiker verwijderen (admin)
app.delete("/api/users/:token", (req,res)=>{
  const adminToken = req.header("x-admin-token");
  if(adminToken !== ADMIN_TOKEN) return res.status(403).json({error:"Alleen beheerder mag verwijderen"});

  const {token} = req.params;
  let users = loadUsers();
  const index = users.findIndex(u => u.token === token);
  if(index === -1) return res.status(404).json({error:"Gebruiker niet gevonden"});
  const removed = users.splice(index,1)[0];
  saveUsers(users);
  res.json({message:`${removed.name} verwijderd`});
});

// Resetdatum aanpassen (admin)
app.put("/api/users/:token/resetdate", (req,res)=>{
  const adminToken = req.header("x-admin-token");
  if(adminToken !== ADMIN_TOKEN) return res.status(403).json({error:"Alleen beheerder kan resetdatum aanpassen"});

  const {token} = req.params;
  const {newDate} = req.body;
  const users = loadUsers();
  const user = users.find(u => u.token === token);
  if(!user) return res.status(404).json({error:"Gebruiker niet gevonden"});

  user.last_reset = new Date(newDate);
  saveUsers(users);
  res.json({message:`Resetdatum van ${user.name} aangepast`});
});

// Zelf resetten (gebruiker)
app.post("/api/reset", (req,res)=>{
  const {token} = req.body;
  if(!token) return res.status(400).json({error:"Geen token"});
  const users = loadUsers();
  const user = users.find(u=>u.token === token);
  if(!user) return res.status(404).json({error:"Gebruiker niet gevonden"});

  user.last_reset = new Date();
  saveUsers(users);
  res.json({message:`${user.name} is gereset`});
});

// Start server
app.listen(PORT, ()=>{
  console.log(`Server draait op http://localhost:${PORT}`);
});
