import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import { globalDealer } from './lastLetterGame.js';

let sock = null;
let qrCodeDataUrl = '';
let connectionStatus = 'disconnected';
let botUser = null;

export async function initWhatsAppBot() {
  if (sock) return { sock, connectionStatus, qrCodeDataUrl };

  const authDir = path.join(process.cwd(), 'baileys_auth');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'connecting';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error(err);
      }
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeDataUrl = '';
      botUser = sock.user;
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'disconnected';
      qrCodeDataUrl = '';
      sock = null;
      if (shouldReconnect) {
        setTimeout(initWhatsAppBot, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
      if (!text) continue;

      const senderName = msg.pushName || remoteJid.split('@')[0];
      const lowerText = text.toLowerCase();

      if (lowerText === '.help') {
        const helpText = `🎮 *LAST LETTER BOT* 🎮\n\n` +
          `*Daftar Perintah (Prefix .):*\n` +
          `• *.newgame* : Membuat room baru (Anda menjadi Room Master)\n` +
          `• *.join* : Bergabung ke room permainan\n` +
          `• *.start* : Memulai permainan (Hanya Room Master)\n` +
          `• *.submit <kata>* atau *<kata>* : Memasukkan kata pada giliran Anda\n` +
          `• *.status* : Melihat kata terakhir & giliran saat ini\n` +
          `• *.pass* : Skip / lewati giliran saat ini\n` +
          `• *.reset* : Mengakhiri game (Hanya Room Master)\n\n` +
          `*Pesan Peringatan:*\n` +
          `• *KATA TELAH DIPAKAI!* : Kata sudah pernah dimainkan.\n` +
          `• *KATA TIDAK SESUAI!* : Kata tidak terdaftar atau huruf awal salah.`;
        await sock.sendMessage(remoteJid, { text: helpText });
        continue;
      }

      if (lowerText === '.newgame') {
        const result = globalDealer.createRoom(senderName);
        await sock.sendMessage(remoteJid, { text: result.message });
        continue;
      }

      if (lowerText === '.join') {
        const result = globalDealer.joinRoom(senderName);
        await sock.sendMessage(remoteJid, { text: result.message });
        continue;
      }

      if (lowerText === '.start') {
        const result = globalDealer.startGame(senderName);
        await sock.sendMessage(remoteJid, { text: result.message });
        continue;
      }

      if (lowerText === '.status') {
        const st = globalDealer.getState();
        if (!st.room_master) {
          await sock.sendMessage(remoteJid, { text: 'ℹ️ Belum ada room aktif. Ketik *.newgame* untuk membuat room.' });
        } else {
          const statusMsg = `📊 *STATUS GAME LAST LETTER* 📊\n\n` +
            `• Room Master: *${st.room_master}*\n` +
            `• Status: *${st.game_started ? 'Sedang Dimainkan' : 'Menunggu Player'}*\n` +
            `• Giliran: *${st.current_player || '-'}*\n` +
            `• Kata Terakhir: *${st.previous_word || '(Bebas)'}*\n` +
            `• Huruf Wajib Berikutnya: *${st.required_letter || '-'}*\n` +
            `• Daftar Player: ${st.players.join(', ')}`;
          await sock.sendMessage(remoteJid, { text: statusMsg });
        }
        continue;
      }

      if (lowerText === '.pass') {
        const res = globalDealer.eliminateCurrentPlayer();
        await sock.sendMessage(remoteJid, { text: res.message });
        continue;
      }

      if (lowerText === '.reset') {
        const res = globalDealer.reset(senderName);
        await sock.sendMessage(remoteJid, { text: res.message });
        continue;
      }

      if (globalDealer.gameStarted && !globalDealer.gameOver) {
        let submittedWord = text;
        if (lowerText.startsWith('.submit ')) {
          submittedWord = text.substring(8).trim();
        }
        if (submittedWord.startsWith('.')) continue;

        const res = globalDealer.submitWord(submittedWord);
        await sock.sendMessage(remoteJid, { text: res.message });
      }
    }
  });

  return { sock, connectionStatus, qrCodeDataUrl };
}

export function getBotInfo() {
  return {
    connectionStatus,
    qrCodeDataUrl,
    botUser,
    gameState: globalDealer.getState()
  };
}
