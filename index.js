const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // kita handle sendiri biar rapi
  });

  // Simpan sesi otomatis setiap kali ada update credentials
  sock.ev.on("creds.update", saveCreds);

  // Tampilkan QR Code di terminal (hanya saat pertama kali / sesi expired)
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 Scan QR Code ini dengan WhatsApp kamu:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log(
        "🔌 Koneksi terputus. Alasan:",
        lastDisconnect?.error?.message
      );

      if (shouldReconnect) {
        console.log("🔄 Mencoba reconnect...");
        startBot(); // reconnect otomatis
      } else {
        console.log("🚪 Logged out. Hapus folder auth_info lalu jalankan ulang.");
      }
    }

    if (connection === "open") {
      console.log("✅ Bot WhatsApp berhasil terhubung!");
    }
  });

  // Handler pesan masuk
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      // Abaikan pesan dari diri sendiri
      if (msg.key.fromMe) continue;

      // Ambil teks pesan (handle berbagai format)
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      const sender = msg.key.remoteJid;

      console.log(`📨 Pesan dari ${sender}: "${text}"`);

      // Cek apakah pesannya "hai" (case-insensitive)
      if (text.toLowerCase().trim() === "hai") {
        console.log(`⏳ Menunggu 3 detik sebelum membalas...`);

        // Jeda 3 detik
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Kirim balasan
        await sock.sendMessage(sender, { text: "hallo" });
        console.log(`✅ Balasan "hallo" terkirim ke ${sender}`);
      }
    }
  });
}

startBot().catch((err) => {
  console.error("❌ Error menjalankan bot:", err);
  process.exit(1);
});
