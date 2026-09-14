'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [botInfo, setBotInfo] = useState({
    connectionStatus: 'connecting',
    qrCodeDataUrl: '',
    botUser: null,
    gameState: {
      room_master: null,
      game_started: false,
      game_over: false,
      winner: null,
      players: [],
      current_player: null,
      previous_word: '',
      required_letter: '',
      history: []
    }
  });

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot');
      const data = await res.json();
      setBotInfo(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    try {
      await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const { connectionStatus, qrCodeDataUrl, gameState } = botInfo;

  return (
    <div className="dashboard-container">
      <header className="header">
        <div className="logo-group">
          <span className="tag">WhatsApp Bot Integration</span>
          <h1>Last Letter <span>Bot</span></h1>
        </div>
        <button onClick={handleReset} className="btn btn-secondary">Reset Game State</button>
      </header>

      {connectionStatus !== 'connected' && (
        <section className="card qr-section">
          <h2>Scan QR Code dengan WhatsApp Anda</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
            Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat, lalu arahkan kamera ke QR Code di bawah.
          </p>

          <div className="qr-wrapper">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="WhatsApp QR Code" className="qr-img" />
            ) : (
              <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                Memuat QR Code...
              </div>
            )}
          </div>

          <div>
            <span className={`status-badge ${connectionStatus}`}>
              Status: {connectionStatus.toUpperCase()}
            </span>
          </div>
        </section>
      )}

      {connectionStatus === 'connected' && (
        <section className="card" style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: 'var(--primary)' }}>WhatsApp Bot Terhubung! 🎉</h2>
              <p style={{ color: 'var(--text-muted)' }}>Bot siap menerima perintah di WhatsApp Anda.</p>
            </div>
            <span className="status-badge connected">CONNECTED</span>
          </div>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <h3>Daftar Perintah Chat WhatsApp (Prefix .)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Perintah yang didukung di WhatsApp:
          </p>

          <ul className="cmd-list">
            <li className="cmd-item">
              <code>.newgame</code>
              <span>Membuat Room &amp; Jadi Room Master</span>
            </li>
            <li className="cmd-item">
              <code>.join</code>
              <span>Bergabung ke Room</span>
            </li>
            <li className="cmd-item">
              <code>.start</code>
              <span>Mulai Game (Khusus Room Master)</span>
            </li>
            <li className="cmd-item">
              <code>.submit &lt;kata&gt;</code> (atau langsung <code>&lt;kata&gt;</code>)
              <span>Kirim Kata</span>
            </li>
            <li className="cmd-item">
              <code>.status</code>
              <span>Cek Status &amp; Last Letter</span>
            </li>
            <li className="cmd-item">
              <code>.pass</code>
              <span>Skip Giliran Saat Ini</span>
            </li>
            <li className="cmd-item">
              <code>.reset</code>
              <span>Terminate Game (Khusus Room Master)</span>
            </li>
            <li className="cmd-item">
              <code>.help</code>
              <span>Tampilkan Bantuan Perintah</span>
            </li>
          </ul>
        </section>

        <section className="card">
          <h3>Status Game Saat Ini</h3>

          {!gameState.room_master ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Belum ada room aktif di WhatsApp. Ketik <code>.newgame</code> di WhatsApp untuk membuat room.
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Room Master:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>{gameState.room_master}</div>
              </div>

              {gameState.game_started ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Giliran Sekarang:</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{gameState.current_player}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Huruf Wajib:</span>
                      <div className="letter-circle">{gameState.required_letter || '-'}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kata Terakhir:</span>
                    <div className="word-badge">{gameState.previous_word || '(Bebas)'}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 0', color: '#eab308' }}>
                  Menunggu Room Master (<strong>{gameState.room_master}</strong>) mengetik <code>.start</code>...
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daftar Player ({gameState.players.length}):</span>
                <div className="players-flex">
                  {gameState.players.map((p, idx) => (
                    <span key={idx} className={`player-chip ${p === gameState.current_player ? 'active' : ''}`}>
                      {p} {p === gameState.room_master ? '(Master)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
