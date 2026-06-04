const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const tmi = require("tmi.js");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Coloque os canais SEM @ nas variáveis do Render
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || "icarolinaporto";
const KICK_CHANNEL = process.env.KICK_CHANNEL || "carolinaporto";

app.get("/", (req, res) => {
  res.send("Overlay server online");
});

// Teste manual:
// https://SEU-APP.onrender.com/test?line=1&text=TESTE
app.get("/test", (req, res) => {
  const line = Number(req.query.line || 1);
  const text = String(req.query.text || "TESTE").slice(0, 200);

  io.emit("chat_message", {
    line,
    text,
    user: "teste",
    platform: "test"
  });

  res.send(`Enviado linha ${line}: ${text}`);
});

io.on("connection", (socket) => {
  console.log("Overlay conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Overlay desconectado:", socket.id);
  });
});

function normalizeUser(user) {
  return String(user || "").toLowerCase().trim();
}

function canUseCommand(isMod, isBroadcaster) {
  return Boolean(isMod || isBroadcaster);
}

function parseCommand(message) {
  const text = String(message || "").trim();

  let m = text.match(/^!l1\s+(.+)/i);
  if (m) return { line: 1, value: m[1].trim() };

  m = text.match(/^!l2\s+(.+)/i);
  if (m) return { line: 2, value: m[1].trim() };

  if (/^!clear1$/i.test(text)) return { line: 1, value: "" };
  if (/^!clear2$/i.test(text)) return { line: 2, value: "" };

  return null;
}

function sendCommand(platform, username, message, isMod, isBroadcaster) {
  console.log(`[${platform}] ${username}: ${message}`);

  const cmd = parseCommand(message);
  if (!cmd) return;

  if (!canUseCommand(isMod, isBroadcaster)) {
    console.log(`[${platform}] sem permissão: ${username}`);
    return;
  }

  const payload = {
    line: cmd.line,
    text: String(cmd.value).slice(0, 200),
    user: username,
    platform
  };

  console.log("Comando enviado:", payload);
  io.emit("chat_message", payload);
}

/* =========================
   TWITCH
========================= */

const twitchClient = new tmi.Client({
  options: {
    debug: true
  },
  connection: {
    reconnect: true,
    secure: true
  },
  channels: [TWITCH_CHANNEL]
});

twitchClient.connect()
  .then(() => console.log("Twitch conectado:", TWITCH_CHANNEL))
  .catch((err) => console.error("Erro Twitch:", err));

twitchClient.on("message", (channel, userstate, message, self) => {
  if (self) return;

  const username = userstate.username || "";
  const badges = userstate.badges || {};

  const isBroadcaster = Boolean(badges.broadcaster);
  const isMod = Boolean(userstate.mod || badges.moderator);

  sendCommand("twitch", username, message, isMod, isBroadcaster);
});

/* =========================
   KICK
========================= */

async function startKick() {
  try {
    const kick = await import("@retconned/kick-js");
    const { createClient } = kick;

    const kickClient = createClient(KICK_CHANNEL, {
      logger: true,
      readOnly: true
    });

    kickClient.on("ready", () => {
      console.log("Kick conectado:", KICK_CHANNEL);
    });

    kickClient.on("ChatMessage", (message) => {
      const username =
        message?.sender?.username ||
        message?.sender?.slug ||
        message?.user?.username ||
        "unknown";

      const text =
        message?.content ||
        message?.message ||
        "";

      const badges = message?.sender?.badges || [];
      const badgeText = JSON.stringify(badges).toLowerCase();

      const isMod =
        badgeText.includes("moderator") ||
        badgeText.includes("mod");

      const isBroadcaster =
        normalizeUser(username) === normalizeUser(KICK_CHANNEL) ||
        badgeText.includes("broadcaster") ||
        badgeText.includes("host") ||
        badgeText.includes("owner");

      sendCommand("kick", username, text, isMod, isBroadcaster);
    });

    kickClient.connect();
  } catch (err) {
    console.error("Erro Kick:", err);
  }
}

startKick();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});