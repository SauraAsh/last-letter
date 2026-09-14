import { wordSet } from './dictionary.js';

export function isWordUsed(word, usedWords) {
  const normalized = word.trim().toLowerCase();
  for (let i = 0; i < usedWords.length; i++) {
    if (usedWords[i].trim().toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

export function getRandomStartingLetter() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const randomIndex = Math.floor(Math.random() * alphabet.length);
  return alphabet[randomIndex];
}

export function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} detik`);

  return parts.join(' ');
}

export function determineNextRequiredLetter(previousWord, usedWords, dictionarySet = wordSet, difficulty = 'easy') {
  if (!previousWord) return '';
  const cleaned = previousWord.trim().toLowerCase();
  if (!cleaned) return '';

  const diff = String(difficulty).toLowerCase().trim();
  let count = 1;
  if (diff === 'hard') {
    count = 3;
  } else if (diff === 'medium') {
    count = 2;
  } else {
    count = 1;
  }

  const maxAllowed = Math.max(1, cleaned.length - 1);
  if (count > maxAllowed) {
    count = maxAllowed;
  }

  let prefix = cleaned.slice(cleaned.length - count);

  if (count > 1) {
    let exists = false;
    for (const w of dictionarySet) {
      if (w.startsWith(prefix) && !isWordUsed(w, usedWords)) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      prefix = cleaned.slice(cleaned.length - 1);
    }
  }

  return prefix;
}

export function getRecommendedWord(requiredLetter, usedWords, dictionarySet = wordSet) {
  if (!requiredLetter) return '';
  const req = requiredLetter.trim().toLowerCase();
  const candidates = [];
  for (const word of dictionarySet) {
    if (word.startsWith(req) && !isWordUsed(word, usedWords)) {
      candidates.push(word.toUpperCase());
      if (candidates.length >= 30) break;
    }
  }
  if (!candidates.length) return '';
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

export function validateWord(word, previousWord, requiredLetter, usedWords, dictionarySet = wordSet) {
  if (!word || !word.trim()) {
    return { valid: false, reason: 'empty', message: '*KATA TIDAK SESUAI!* Kata tidak boleh kosong.' };
  }
  const normalized = word.trim().toLowerCase();
  if (requiredLetter) {
    const req = requiredLetter.trim().toLowerCase();
    if (!normalized.startsWith(req)) {
      return { valid: false, reason: 'wrong_letter', message: `*KATA TIDAK SESUAI!* Kata harus dimulai dengan huruf '${req.toUpperCase()}'.` };
    }
  }
  if (isWordUsed(normalized, usedWords)) {
    return { valid: false, reason: 'used', message: `*KATA TELAH DIPAKAI!* Kata '${normalized.toUpperCase()}' sudah pernah digunakan.` };
  }
  if (!dictionarySet.has(normalized)) {
    return { valid: false, reason: 'not_in_dict', message: `*KATA TIDAK SESUAI!* Kata '${normalized.toUpperCase()}' tidak ditemukan di dictionary.` };
  }
  return { valid: true, reason: 'valid', message: 'Kata valid!' };
}

export class GameRoom {
  constructor(roomId, masterName, masterJid, isPrivate = false, password = '', difficulty = 'easy', dictionarySet = wordSet) {
    this.roomId = roomId;
    this.dictionarySet = dictionarySet;
    this.isPrivate = isPrivate;
    this.password = password;
    this.difficulty = difficulty;
    this.roomMaster = masterName.trim();
    this.roomMasterJid = masterJid;
    this.players = [this.roomMaster];
    this.playerJids = [masterJid];
    this.currentPlayerIndex = 0;
    this.previousWord = '';
    this.requiredLetter = '';
    this.usedWords = [];
    this.history = [];
    this.gameStarted = false;
    this.gameOver = false;
    this.winner = null;
    this.initialPlayerCount = 0;
    this.eligibleForExp = false;
    this.startTime = null;
    this.playerSurvivalTimes = {};
  }

  joinRoom(playerName, playerJid, password = '') {
    if (this.gameStarted) {
      return { success: false, message: `Game di Room *${this.roomId}* sudah berjalan, tidak bisa bergabung.` };
    }
    if (this.isPrivate && password !== this.password) {
      return { success: false, message: `🔒 Password Room *${this.roomId}* salah!` };
    }
    const name = playerName.trim();
    if (this.playerJids.includes(playerJid)) {
      return { success: false, message: `Akun WhatsApp Anda sudah berada di Room *${this.roomId}* (*${name}*).` };
    }
    if (this.players.includes(name)) {
      return { success: false, message: `Username *${name}* sudah ada di Room *${this.roomId}*.` };
    }
    this.players.push(name);
    this.playerJids.push(playerJid);
    return { success: true, message: `Player *${name}* berhasil bergabung di Room *${this.roomId}*! Total Player: ${this.players.join(', ')}` };
  }

  startGame(requestorJid) {
    if (requestorJid && requestorJid !== this.roomMasterJid) {
      return { success: false, message: `Hanya Room Master (*${this.roomMaster}*) yang berhak memulai game!` };
    }
    if (this.players.length < 2) {
      return { success: false, message: 'Minimal 2 player untuk memulai game. Minta player lain bergabung.' };
    }
    this.currentPlayerIndex = 0;
    this.previousWord = '';
    this.requiredLetter = getRandomStartingLetter();
    this.usedWords = [];
    this.history = [];
    this.gameStarted = true;
    this.gameOver = false;
    this.winner = null;
    this.initialPlayerCount = this.players.length;
    this.eligibleForExp = this.players.length >= 3;
    this.startTime = Date.now();
    this.playerSurvivalTimes = {};

    const expNotice = this.eligibleForExp ? ' (Sistem EXP: Aktif)' : ' (Sistem EXP: Nonaktif - Min. 3 Player)';
    const roomType = this.isPrivate ? 'PRIVATE 🔒' : 'PUBLIC 🌐';
    return { success: true, message: `🎉 *GAME STARTED - ROOM ${this.roomId} (${roomType})!* 🎉${expNotice}\n\n• Room Master: *${this.roomMaster}*\n• Mode: *${this.difficulty.toUpperCase()}*\n• Players: ${this.players.join(', ')}\n• Giliran Pertama: *${this.getCurrentPlayer()}*\n👉 Huruf Wajib Pertama: *${this.requiredLetter.toUpperCase()}*` };
  }

  getCurrentPlayer() {
    if (!this.players.length || !this.gameStarted) return null;
    return this.players[this.currentPlayerIndex];
  }

  getCurrentPlayerJid() {
    if (!this.playerJids.length || !this.gameStarted) return null;
    return this.playerJids[this.currentPlayerIndex];
  }

  nextTurn() {
    if (!this.players.length || this.gameOver) return;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  submitWord(word) {
    if (!this.gameStarted) {
      return { success: false, message: 'Game belum dimulai di room ini.' };
    }
    if (this.gameOver) {
      return { success: false, message: 'Game sudah selesai di room ini.' };
    }
    const validation = validateWord(word, this.previousWord, this.requiredLetter, this.usedWords, this.dictionarySet);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    const normalized = word.trim().toLowerCase();
    const currentPlayer = this.getCurrentPlayer();
    this.usedWords.push(normalized);
    this.history.push({ player: currentPlayer, word: normalized.toUpperCase() });
    this.previousWord = normalized;
    this.requiredLetter = determineNextRequiredLetter(normalized, this.usedWords, this.dictionarySet, this.difficulty);
    this.nextTurn();
    const nextPlayer = this.getCurrentPlayer();
    return { success: true, message: `✅ Kata '*${normalized.toUpperCase()}*' valid!\n\n• Room: *${this.roomId}*\n• Kata Terakhir: *${normalized.toUpperCase()}*\n• Huruf Wajib Berikutnya (${this.requiredLetter.length} Huruf): *${this.requiredLetter.toUpperCase()}*\n👉 Giliran Sekarang: *${nextPlayer}*` };
  }

  eliminateCurrentPlayer() {
    if (!this.gameStarted || !this.players.length || this.gameOver) {
      return { success: false, message: 'Game tidak aktif.' };
    }
    const elapsed = Date.now() - (this.startTime || Date.now());
    const hintWord = getRecommendedWord(this.requiredLetter, this.usedWords, this.dictionarySet);
    const eliminated = this.players.splice(this.currentPlayerIndex, 1)[0];
    this.playerJids.splice(this.currentPlayerIndex, 1);
    this.playerSurvivalTimes[eliminated] = elapsed;

    let recText = '';
    if (hintWord) {
      recText = `\n💡 *Rekomendasi Jawaban:* .submit ${hintWord.toLowerCase()}`;
    }

    if (this.players.length === 1) {
      this.gameOver = true;
      this.winner = this.players[0];
      this.playerSurvivalTimes[this.winner] = elapsed;

      let statsText = `\n\n⏱️ *STATISTIK PERTANDINGAN:*\n• Total Durasi Game: *${formatDuration(elapsed)}*\n• Lama Bertahan Pemain:`;
      for (const p of Object.keys(this.playerSurvivalTimes)) {
        const isWin = p === this.winner;
        const label = isWin ? ' (Pemenang 🏆)' : '';
        statsText += `\n  - *${p}*: ${formatDuration(this.playerSurvivalTimes[p])}${label}`;
      }

      return { success: true, message: `Player *${eliminated}* tereliminasi!${recText}\n\n🏆 Pemenang game adalah *${this.winner}*!${statsText}` };
    }
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }
    const nextPlayer = this.getCurrentPlayer();
    return { success: true, message: `Player *${eliminated}* tereliminasi/di-skip!${recText}\n👉 Giliran beralih ke *${nextPlayer}*.` };
  }
}

export class MultiRoomManager {
  constructor() {
    this.rooms = {};
    this.nextRoomNumber = 101;
  }

  generateRoomId() {
    const id = `RM-${this.nextRoomNumber}`;
    this.nextRoomNumber++;
    return id;
  }

  createRoom(masterName, masterJid, isPrivate = false, password = '', difficulty = 'easy') {
    for (const id of Object.keys(this.rooms)) {
      const room = this.rooms[id];
      if (room.playerJids.includes(masterJid) && !room.gameOver) {
        return { success: false, message: `Akun WhatsApp Anda masih berada di Room *${id}*. Tinggalkan room tersebut terlebih dahulu.` };
      }
    }

    const roomId = this.generateRoomId();
    const room = new GameRoom(roomId, masterName, masterJid, isPrivate, password, difficulty);
    this.rooms[roomId] = room;
    const roomType = isPrivate ? `PRIVATE 🔒 (Pass: *${password}*)` : 'PUBLIC 🌐';
    return { success: true, roomId, message: `Room *${roomId}* (${roomType}) [Mode: *${difficulty.toUpperCase()}*] berhasil dibuat oleh Room Master *${masterName}*!` };
  }

  getRoom(roomId) {
    return this.rooms[roomId] || null;
  }

  findRoomByPlayerJid(playerJid) {
    for (const id of Object.keys(this.rooms)) {
      const room = this.rooms[id];
      if (room.playerJids.includes(playerJid) && !room.gameOver) {
        return room;
      }
    }
    return null;
  }

  listPublicRooms() {
    const publicRooms = [];
    for (const id of Object.keys(this.rooms)) {
      const room = this.rooms[id];
      if (!room.isPrivate && !room.gameOver) {
        publicRooms.push({
          roomId: room.roomId,
          roomMaster: room.roomMaster,
          difficulty: room.difficulty,
          playerCount: room.players.length,
          gameStarted: room.gameStarted
        });
      }
    }
    return publicRooms;
  }

  listPrivateRooms() {
    const privateRooms = [];
    for (const id of Object.keys(this.rooms)) {
      const room = this.rooms[id];
      if (room.isPrivate && !room.gameOver) {
        privateRooms.push({
          roomId: room.roomId,
          roomMaster: room.roomMaster,
          difficulty: room.difficulty,
          playerCount: room.players.length,
          gameStarted: room.gameStarted
        });
      }
    }
    return privateRooms;
  }
}

export const multiRoomManager = new MultiRoomManager();
