import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.join(__dirname, '..', '..', 'users.json');

function loadUsers() {
  try {
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, JSON.stringify({}), 'utf-8');
      return {};
    }
    const raw = fs.readFileSync(storePath, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(storePath, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error(err);
  }
}

export function registerUser(jid, username) {
  const users = loadUsers();
  const cleanName = username.trim();
  if (!cleanName) {
    return { success: false, message: '⚠️ Username tidak boleh kosong.' };
  }

  if (users[jid]) {
    return { success: false, message: `⚠️ Akun WhatsApp Anda sudah terdaftar dengan username *${users[jid].username}* dan tidak bisa mendaftar ulang!` };
  }

  for (const key of Object.keys(users)) {
    if (users[key].username.toLowerCase() === cleanName.toLowerCase()) {
      return { success: false, message: `⚠️ Username *${cleanName}* sudah digunakan oleh pengguna lain.` };
    }
  }

  users[jid] = {
    username: cleanName,
    exp: 0
  };

  saveUsers(users);
  return { success: true, message: `✅ Berhasil mendaftar! Username Anda: *${cleanName}* (EXP: 0)` };
}

export function getUserByJid(jid) {
  const users = loadUsers();
  return users[jid] || null;
}

export function getUserByUsername(username) {
  const users = loadUsers();
  const cleanName = username.trim().toLowerCase();
  for (const key of Object.keys(users)) {
    if (users[key].username.toLowerCase() === cleanName) {
      return { jid: key, ...users[key] };
    }
  }
  return null;
}

export function addExpByUsername(username, amount) {
  const users = loadUsers();
  const cleanName = username.trim().toLowerCase();
  for (const key of Object.keys(users)) {
    if (users[key].username.toLowerCase() === cleanName) {
      users[key].exp = Math.max(0, (users[key].exp || 0) + amount);
      saveUsers(users);
      return users[key];
    }
  }
  return null;
}

export function getLeaderboard() {
  const users = loadUsers();
  const list = [];
  for (const key of Object.keys(users)) {
    list.push({
      jid: key,
      username: users[key].username,
      exp: users[key].exp || 0
    });
  }
  list.sort((a, b) => b.exp - a.exp);
  return list;
}
