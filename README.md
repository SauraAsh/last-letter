# 🎮 Last Letter (WhatsApp Bot & Scrabble)

> Bot WhatsApp interaktif untuk bermain game **Last Letter** (sambung kata) dengan sistem validasi kata otomatis menggunakan kamus Scrabble.

---

## 📌 Deskripsi Game
**Last Letter** adalah permainan sambung kata di mana setiap pemain harus membalas kata baru yang huruf awalnya merupakan huruf terakhir dari kata yang dikirimkan sebelumnya. Bot ini secara otomatis memvalidasi apakah kata yang dikirimkan pemain benar dan terdaftar dalam kamus.

## ✨ Fitur Utama
- **Permainan Sambung Kata Interaktif:** Pemain bermain langsung di ruang percakapan WhatsApp.
- **Validasi Otomatis:** Memeriksa kesesuaian huruf awal dan keabsahan kata berdasarkan kamus.
- **Integrasi Scrabble:** Menggunakan basis data kata Scrabble untuk menentukan validitas kata.

## 📁 Struktur Folder
- `whatsapp-bot/` : Berisi *source code* bot WhatsApp yang dibangun menggunakan Node.js dan Next.js.
- `Scrabble/` : Berisi daftar kata pendukung (`sowpods.txt`) dan modul pendukung untuk logika permainan.

## 🚀 Cara Menjalankan
1. Masuk ke direktori bot:
   ```bash
   cd whatsapp-bot
   ```
2. Instal semua dependensi:
   ```bash
   npm install
   ```
3. Jalankan server lokal:
   ```bash
   npm run dev
   ```

## 📜 Kredit & Lisensi
Daftar kata (`sowpods.txt`) yang digunakan pada proyek ini bersumber dari repositori terbuka:
- **Kredit Pembuat:** [jesstess](https://github.com/jesstess)
- **Repositori Asal:** [jesstess/Scrabble](https://github.com/jesstess/Scrabble)
- **Sumber File:** [sowpods.txt](https://github.com/jesstess/Scrabble/blob/master/scrabble/sowpods.txt)

Terima kasih kepada pembuat asli atas kontribusinya pada repositori sumber terbuka.