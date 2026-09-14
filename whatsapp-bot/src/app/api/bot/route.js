import { NextResponse } from 'next/server';
import { initWhatsAppBot, getBotInfo } from '@/lib/whatsappBot.js';
import { globalDealer } from '@/lib/lastLetterGame.js';

export async function GET() {
  await initWhatsAppBot();
  const info = getBotInfo();
  return NextResponse.json(info);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { action, players, word } = body;

  let message = '';
  let success = true;

  if (action === 'init') {
    await initWhatsAppBot();
  } else if (action === 'start') {
    const res = globalDealer.startGame(players || []);
    success = res.success;
    message = res.message;
  } else if (action === 'submit') {
    const res = globalDealer.submitWord(word || '');
    success = res.success;
    message = res.message;
  } else if (action === 'eliminate') {
    const res = globalDealer.eliminateCurrentPlayer();
    success = res.success;
    message = res.message;
  } else if (action === 'reset') {
    globalDealer.reset();
    message = 'Game di-reset.';
  }

  const info = getBotInfo();
  return NextResponse.json({
    ...info,
    actionResult: { success, message }
  });
}
