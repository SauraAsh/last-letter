import makeWASocket, { useMultiFileAuthState, DisconnectReason, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import { multiRoomManager } from './src/lib/lastLetterGame.js';
import { registerUser, getUserByJid, getLeaderboard, addExpByUsername } from './src/lib/userStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roomTimers = {};

function stopTurnTimer(roomId) {
  if (roomTimers[roomId]) {
    clearInterval(roomTimers[roomId].interval);
    delete roomTimers[roomId];
  }
}

function startTurnTimer(roomId, remoteJid, sock) {
  stopTurnTimer(roomId);
  const room = multiRoomManager.getRoom(roomId);
  if (!room || !room.gameStarted || room.gameOver) return;

  roomTimers[roomId] = {
    secondsRemaining: 20,
    interval: null
  };

  roomTimers[roomId].interval = setInterval(async () => {
    const activeRoom = multiRoomManager.getRoom(roomId);
    if (!activeRoom || !activeRoom.gameStarted || activeRoom.gameOver) {
      stopTurnTimer(roomId);
      return;
    }

    roomTimers[roomId].secondsRemaining--;
    const secs = roomTimers[roomId].secondsRemaining;

    if (secs === 15 || secs === 10 || secs === 5) {
      await sock.sendMessage(remoteJid, { text: `⚠️ [Room *${roomId}*] Waktu tersisa ${secs} detik!` });
    }

    if (secs <= 0) {
      stopTurnTimer(roomId);
      const currentPl = activeRoom.getCurrentPlayer();
      if (activeRoom.eligibleForExp && currentPl) {
        addExpByUsername(currentPl, -2);
      }
      const res = activeRoom.eliminateCurrentPlayer();
      const expPenaltyMsg = activeRoom.eligibleForExp ? ' (-2 EXP)' : '';
      let timeoutMsg = `⏰ *WAKTU HABIS!* Player *${currentPl}*${expPenaltyMsg} tidak menjawab dalam 20 detik dan di-kick dari room!\n\n${res.message}`;

      if (activeRoom.gameOver && activeRoom.winner) {
        if (activeRoom.eligibleForExp) {
          addExpByUsername(activeRoom.winner, 5);
          timeoutMsg += `\n\n🎉 Player *${activeRoom.winner}* mendapatkan +5 Bonus EXP Pemenang!`;
        }
      }

      await sock.sendMessage(remoteJid, { text: timeoutMsg });

      if (activeRoom.gameStarted && !activeRoom.gameOver) {
        startTurnTimer(roomId, remoteJid, sock);
      }
    }
  }, 1000);
}

async function sendNativeFlowButtons(sock, remoteJid, text, buttonsInput) {
  const formattedButtons = buttonsInput.map(btn => {
    return {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: btn.title,
        id: btn.id
      })
    };
  });

  const flowParams = JSON.stringify({
    bottom_sheet: {
      in_thread_buttons_limit: 2,
      list_title: "Daftar Menu",
      button_title: "Pilih Menu"
    }
  });

  const messagePayload = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2
        },
        interactiveMessage: {
          body: {
            text: text
          },
          footer: {
            text: "✦ Assistant Bot"
          },
          nativeFlowMessage: {
            messageParamsJson: flowParams,
            buttons: formattedButtons
          }
        }
      }
    }
  };

  const msg = generateWAMessageFromContent(remoteJid, messagePayload, {});
  await sock.relayMessage(remoteJid, msg.message, { messageId: msg.key.id });
}

async function startBot() {
  console.log("==================================================");
  console.log("🎮 LAST LETTER WHATSAPP BOT (MULTI-ROOM EDITION) 🎮");
  console.log("==================================================");
  console.log("Memulai koneksi WhatsApp...");

  const authDir = path.join(__dirname, 'baileys_auth');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n==================================================");
      console.log("📱 SILAKAN SCAN QR CODE DI BAWAH MENGGUNAKAN WHATSAPP:");
      console.log("==================================================\n");
      qrcodeTerminal.generate(qr, { small: true }, (ascii) => {
        console.log(ascii);
      });
      console.log("\n==================================================\n");
    }

    if (connection === 'open') {
      console.log("\n==================================================");
      console.log("✅ WHATSAPP BOT BERHASIL TERHUBUNG!");
      console.log(`Nomor Bot: ${sock.user.id.split(':')[0]}`);
      console.log("Bot siap menerima perintah di Chat Pribadi & Grup WhatsApp!");
      console.log("==================================================\n");
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Koneksi terputus (code: ${statusCode}). Mencoba terhubung kembali...`);
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      const senderJid = msg.key.participant || msg.key.remoteJid;

      let text = (msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.buttonsResponseMessage?.selectedButtonId ||
        msg.message.buttonsResponseMessage?.selectedDisplayText ||
        msg.message.templateButtonReplyMessage?.selectedId ||
        msg.message.templateButtonReplyMessage?.selectedDisplayText || '').trim();

      if (msg.message.interactiveResponseMessage?.nativeFlowResponseMessage) {
        try {
          const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
          if (params.id) {
            text = params.id;
          }
        } catch (err) {}
      }

      if (!text && msg.message.pollCreationMessage) {
        continue;
      }

      if (!text) continue;

      const lowerText = text.toLowerCase();

      if (lowerText === '.help' || lowerText === 'help' || lowerText.includes('bantu')) {
        const helpText = `🎮 *LAST LETTER BOT HELP* 🎮\n\nHai, ada yang bisa saya bantu?\nSilakan gunakan perintah berikut:\n\n1. *.regist <username>* - Pendaftaran Akun\n2. *.newgame* - Buat Room Baru\n3. *.join* - Bergabung ke Room\n4. *.leaderboard* - Lihat Top Player`;
        await sock.sendMessage(remoteJid, { text: helpText });
        continue;
      }

      if (lowerText === 'regist' || lowerText === '.regist') {
        await sock.sendMessage(remoteJid, { text: '⚠️ Silakan mendaftar akun dengan format: *.regist <username>*\nContoh: *.regist Budi*' });
        continue;
      }

      if (lowerText.startsWith('.regist ')) {
        const parts = text.split(' ').filter(Boolean);
        if (parts.length < 2) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Format salah! Gunakan: *.regist <username>*' });
          continue;
        }
        const username = parts.slice(1).join(' ').trim();
        const res = registerUser(senderJid, username);
        await sock.sendMessage(remoteJid, { text: res.message });
        continue;
      }

      if (lowerText === '.leaderboard' || lowerText.includes('leaderboard')) {
        const board = getLeaderboard();
        if (!board.length) {
          await sock.sendMessage(remoteJid, { text: '📊 Belum ada pemain terdaftar di leaderboard.' });
          continue;
        }
        let boardText = `🏆 *LEADERBOARD LAST LETTER* 🏆\n\n`;
        board.slice(0, 10).forEach((user, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
          boardText += `${idx + 1}. ${medal} *${user.username}* - ${user.exp} EXP\n`;
        });
        await sock.sendMessage(remoteJid, { text: boardText });
        continue;
      }

      const isGameCmd = lowerText === 'new game' || lowerText.startsWith('.newgame') ||
        lowerText === 'join' || lowerText.startsWith('.join') ||
        lowerText === '.start' || lowerText === '.pass' || lowerText === '.reset' ||
        lowerText.startsWith('.submit ') || lowerText === 'public room' || lowerText === 'private room' ||
        lowerText === 'easy' || lowerText === 'medium' || lowerText === 'hard' ||
        lowerText === 'list public' || lowerText === 'join private';

      if (isGameCmd) {
        const user = getUserByJid(senderJid);
        if (!user) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Anda belum mendaftar! Silakan ketik *.regist <username>* terlebih dahulu agar bisa bermain.' });
          continue;
        }
      }

      if (lowerText === '.newgame' || lowerText === 'new game') {
        const msgText = `➕ *BUAT ROOM BARU*\n\nSilakan ketik:\n• *.newgame public* - Buat Room Publik\n• *.newgame private <password> <easy|medium|hard>* - Buat Room Private`;
        await sock.sendMessage(remoteJid, { text: msgText });
        continue;
      }

      if (lowerText === '.newgame public' || lowerText === 'public room') {
        const msgText = `🌐 *PUBLIC ROOM*\n\nSilakan ketik tingkat kesulitan:\n• *.newgame public easy*\n• *.newgame public medium*\n• *.newgame public hard*`;
        await sock.sendMessage(remoteJid, { text: msgText });
        continue;
      }

      if (lowerText === 'easy' || lowerText === 'medium' || lowerText === 'hard' || lowerText.startsWith('.newgame public ')) {
        const user = getUserByJid(senderJid);
        let diff = 'easy';
        if (lowerText.includes('medium')) diff = 'medium';
        if (lowerText.includes('hard')) diff = 'hard';

        const res = multiRoomManager.createRoom(user.username, senderJid, false, '', diff);
        await sock.sendMessage(remoteJid, { text: res.message });
        continue;
      }

      if (lowerText === '.newgame private' || lowerText === 'private room') {
        const infoMsg = `🔒 *BUAT ROOM PRIVATE*\n\nHarap tentukan password dan kesulitan dengan format:\n*.newgame private <password> <easy|medium|hard>*\n\nContoh: *.newgame private 1234 easy*`;
        await sock.sendMessage(remoteJid, { text: infoMsg });
        continue;
      }

      if (lowerText.startsWith('.newgame private ')) {
        const user = getUserByJid(senderJid);
        const parts = text.split(' ').filter(Boolean);
        if (parts.length < 3) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Format salah! Gunakan: *.newgame private <password> <easy|medium|hard>*\nContoh: *.newgame private 1234 easy*' });
          continue;
        }
        const password = parts[2].trim();
        let diff = 'easy';
        if (parts.length >= 4) {
          const d = parts[3].toLowerCase().trim();
          if (['easy', 'medium', 'hard'].includes(d)) diff = d;
        }
        const res = multiRoomManager.createRoom(user.username, senderJid, true, password, diff);
        await sock.sendMessage(remoteJid, { text: res.message });
        continue;
      }

      if (lowerText === '.join' || lowerText === 'join') {
        const msgText = `🎮 *JOIN GAME*\n\nSilakan ketik perintah berikut:\n• *.join public* - Lihat & Bergabung Public Room\n• *.join private* - Panduan Join Private Room`;
        await sock.sendMessage(remoteJid, { text: msgText });
        continue;
      }

      if (lowerText === '.join public' || lowerText === 'list public') {
        const publicRooms = multiRoomManager.listPublicRooms();
        if (!publicRooms.length) {
          await sock.sendMessage(remoteJid, { text: 'ℹ️ Belum ada Public Room aktif. Ketik *.newgame* untuk membuat room.' });
          continue;
        }

        let listText = `🌐 *DAFTAR PUBLIC ROOMS AKTIF:* 🌐\n\n`;
        publicRooms.forEach((r, idx) => {
          listText += `${idx + 1}. Room *${r.roomId}* | Master: *${r.roomMaster}* | Mode: *${r.difficulty.toUpperCase()}* | Players: ${r.playerCount}\n`;
        });
        listText += `\n📌 Ketik *.join <id_room>* untuk bergabung. Contoh: *.join RM-101*`;

        await sock.sendMessage(remoteJid, { text: listText });
        continue;
      }

      if (lowerText === '.join private' || lowerText === 'join private') {
        const infoMsg = `🔒 *JOIN ROOM PRIVATE*\n\nSilakan masukkan ID Room & Password dengan format:\n*.join <id_room> <password>*\n\nContoh: *.join RM-101 1234*`;
        await sock.sendMessage(remoteJid, { text: infoMsg });
        continue;
      }

      if (lowerText.startsWith('.join ') || lowerText.startsWith('join rm-')) {
        const user = getUserByJid(senderJid);
        const parts = text.replace('(', '').replace(')', '').split(' ').filter(Boolean);

        let targetRoomId = '';
        let pass = '';

        if (parts.length >= 2) {
          targetRoomId = parts[1].toUpperCase().trim();
        }
        if (parts.length >= 3) {
          pass = parts[2].trim();
        }

        const room = multiRoomManager.getRoom(targetRoomId);
        if (!room) {
          await sock.sendMessage(remoteJid, { text: `⚠️ Room *${targetRoomId}* tidak ditemukan!` });
          continue;
        }

        const res = room.joinRoom(user.username, senderJid, pass);
        await sock.sendMessage(remoteJid, { text: res.message });
        continue;
      }

      const playerRoom = multiRoomManager.findRoomByPlayerJid(senderJid);

      if (lowerText === '.start') {
        if (!playerRoom) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Anda belum bergabung di room mana pun! Ketik *.join* atau *.newgame*.' });
          continue;
        }
        const res = playerRoom.startGame(senderJid);
        await sock.sendMessage(remoteJid, { text: res.message });
        if (res.success) {
          startTurnTimer(playerRoom.roomId, remoteJid, sock);
        }
        continue;
      }

      if (lowerText === '.pass') {
        if (!playerRoom) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Anda belum bergabung di room mana pun!' });
          continue;
        }
        const activeJid = playerRoom.getCurrentPlayerJid();
        if (activeJid && senderJid !== activeJid && senderJid !== playerRoom.roomMasterJid) {
          await sock.sendMessage(remoteJid, { text: '⚠️ bukan giliran mu!' });
          continue;
        }

        const res = playerRoom.eliminateCurrentPlayer();
        let passMsg = res.message;

        if (playerRoom.gameOver && playerRoom.winner) {
          if (playerRoom.eligibleForExp) {
            addExpByUsername(playerRoom.winner, 5);
            passMsg += `\n\n🎉 Player *${playerRoom.winner}* mendapatkan +5 Bonus EXP Pemenang!`;
          }
          stopTurnTimer(playerRoom.roomId);
        }

        await sock.sendMessage(remoteJid, { text: passMsg });
        if (playerRoom.gameStarted && !playerRoom.gameOver) {
          startTurnTimer(playerRoom.roomId, remoteJid, sock);
        }
        continue;
      }

      if (lowerText === '.reset') {
        if (!playerRoom) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Anda belum bergabung di room mana pun!' });
          continue;
        }
        if (senderJid !== playerRoom.roomMasterJid) {
          await sock.sendMessage(remoteJid, { text: `⚠️ Hanya Room Master (*${playerRoom.roomMaster}*) yang berhak me-reset game!` });
          continue;
        }
        stopTurnTimer(playerRoom.roomId);
        playerRoom.gameOver = true;
        playerRoom.gameStarted = false;
        await sock.sendMessage(remoteJid, { text: `🔄 Game di Room *${playerRoom.roomId}* telah di-reset.` });
        continue;
      }

      if (lowerText.startsWith('.submit ')) {
        if (!playerRoom) {
          await sock.sendMessage(remoteJid, { text: '⚠️ Anda tidak sedang berada di room permainan aktif mana pun!' });
          continue;
        }

        const activeJid = playerRoom.getCurrentPlayerJid();
        if (activeJid && senderJid !== activeJid) {
          await sock.sendMessage(remoteJid, { text: '⚠️ bukan giliran mu!' });
          continue;
        }

        const currentPl = playerRoom.getCurrentPlayer();
        const submittedWord = text.substring(8).trim();
        const timerObj = roomTimers[playerRoom.roomId];
        const turnSec = timerObj ? timerObj.secondsRemaining : 20;

        const res = playerRoom.submitWord(submittedWord);

        if (res.success) {
          let replyMsg = res.message;

          if (playerRoom.eligibleForExp) {
            let expAdded = 0;
            const currentDiff = (playerRoom.difficulty || 'easy').toLowerCase();

            if (currentDiff === 'easy') {
              expAdded = 1;
            } else {
              if (turnSec >= 15) {
                expAdded = 3;
              } else if (turnSec >= 10) {
                expAdded = 2;
              } else if (turnSec >= 5) {
                expAdded = 1;
              } else {
                expAdded = 0;
              }
            }

            if (currentPl) {
              addExpByUsername(currentPl, expAdded);
            }
            replyMsg += `\n✨ (+${expAdded} EXP)`;
          }

          if (playerRoom.gameOver && playerRoom.winner) {
            if (playerRoom.eligibleForExp) {
              addExpByUsername(playerRoom.winner, 5);
              replyMsg += `\n\n🎉 Player *${playerRoom.winner}* mendapatkan +5 Bonus EXP Pemenang!`;
            }
            stopTurnTimer(playerRoom.roomId);
          }

          await sock.sendMessage(remoteJid, { text: replyMsg });

          if (playerRoom.gameStarted && !playerRoom.gameOver) {
            startTurnTimer(playerRoom.roomId, remoteJid, sock);
          }
        } else {
          await sock.sendMessage(remoteJid, { text: res.message });
        }
      }
    }
  });
}

startBot();
