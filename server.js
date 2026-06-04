const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const tmi = require("tmi.js");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || "icarolinaporto";
const KICK_CHANNEL = process.env.KICK_CHANNEL || "carolinaporto";

app.get("/", (req, res) => {
  res.send("Overlay server online");
});

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

function canUseCommand(isMod, isBroadcaster) {
  return Boolean(isMod || isBroadcaster);
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
   KICK SEM PUPPETEER
========================= */

async function getKickChatroomId(channelName) {
  const url = `https://kick.com/api/v2/channels/${encodeURIComponent(channelName)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar canal Kick: ${response.status}`);
  }

  const data = await response.json();

  const chatroomId =
    data?.chatroom?.id ||
    data?.chatroom_id ||
    data?.livestream?.chatroom_id;

  if (!chatroomId) {
    throw new Error("Não achei chatroom.id da Kick");
  }

  return chatroomId;
}

function parseKickEvent(raw) {
  try {
    const msg = JSON.parse(raw);

    if (msg.event === "pusher:connection_established") {
      return { type: "connected" };
    }

    if (msg.event === "pusher_internal:subscription_succeeded") {
      return { type: "subscribed" };
    }

    if (!String(msg.event || "").includes("ChatMessageEvent")) {
      return null;
    }

    let data = msg.data;

    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    return {
      type: "chat",
      data
    };
  } catch (err) {
    console.error("Erro parseKickEvent:", err);
    return null;
  }
}

function extractKickMessage(data) {
  const username =
    data?.sender?.username ||
    data?.sender?.slug ||
    data?.user?.username ||
    data?.username ||
    "unknown";

  const text =
    data?.content ||
    data?.message ||
    "";

  const badges =
    data?.sender?.badges ||
    data?.badges ||
    [];

  const badgesText = JSON.stringify(badges).toLowerCase();
  const userLower = normalizeUser(username);
  const channelLower = normalizeUser(KICK_CHANNEL);

  const isBroadcaster =
    userLower === channelLower ||
    badgesText.includes("broadcaster") ||
    badgesText.includes("host") ||
    badgesText.includes("owner");

  const isMod =
    badgesText.includes("moderator") ||
    badgesText.includes("mod");

  return {
    username,
    text,
    isMod,
    isBroadcaster
  };
}

async function startKick() {
  try {
    const chatroomId = process.env.KICK_CHATROOM_ID || await getKickChatroomId(KICK_CHANNEL);

    console.log("Kick chatroom ID:", chatroomId);

    const wsUrl = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false";

    let ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      console.log("Kick WebSocket aberto");

      const subscribeMessage = {
        event: "pusher:subscribe",
        data: {
          auth: "",
          channel: `chatrooms.${chatroomId}.v2`
        }
      };

      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on("message", (raw) => {
      const parsed = parseKickEvent(raw.toString());
      if (!parsed) return;

      if (parsed.type === "connected") {
        console.log("Kick conectado:", KICK_CHANNEL);
        return;
      }

      if (parsed.type === "subscribed") {
        console.log("Kick inscrito no chat:", KICK_CHANNEL);
        return;
      }

      if (parsed.type === "chat") {
        const info = extractKickMessage(parsed.data);

        sendCommand(
          "kick",
          info.username,
          info.text,
          info.isMod,
          info.isBroadcaster
        );
      }
    });

    ws.on("close", () => {
      console.log("Kick WebSocket fechado. Reconectando em 5s...");
      setTimeout(startKick, 5000);
    });

    ws.on("error", (err) => {
      console.error("Erro Kick WebSocket:", err.message);
    });
  } catch (err) {
    console.error("Erro ao iniciar Kick:", err.message);
    setTimeout(startKick, 10000);
  }
}

startKick();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
