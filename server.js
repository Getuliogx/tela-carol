const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const tmi = require("tmi.js");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || "carolinaporto";
const KICK_CHANNEL = process.env.KICK_CHANNEL || "carolinaporto";
const KICK_CHATROOM_ID = process.env.KICK_CHATROOM_ID || "";

const state = {
  line1: process.env.DEFAULT_LINE1 || "EP 1 - T1",
  line2: process.env.DEFAULT_LINE2 || "Patrocinador",
  episode: Number(process.env.DEFAULT_EP || 1),
  season: Number(process.env.DEFAULT_SEASON || 1),
  color1: process.env.DEFAULT_COLOR1 || "#ffffff",
  color2: process.env.DEFAULT_COLOR2 || "#f49dee",
  rainbow1: false,
  rainbow2: false
};

function normalizeUser(user) {
  return String(user || "").toLowerCase().trim();
}

function getKickAllowedUsers() {
  return String(process.env.KICK_ALLOWED_USERS || "")
    .split(",")
    .map(u => normalizeUser(u))
    .filter(Boolean);
}

function isAllowed(platform, username, isMod, isBroadcaster) {
  if (isMod || isBroadcaster) return true;
  if (platform === "kick") return getKickAllowedUsers().includes(normalizeUser(username));
  return false;
}

function epText() {
  return `EP ${state.episode} - T${state.season}`;
}

function isHexColor(value) {
  return /^#?[0-9a-f]{6}$/i.test(String(value || "").trim());
}

function normalizeHex(value) {
  const v = String(value || "").trim();
  return v.startsWith("#") ? v : `#${v}`;
}

function parseCommand(message) {
  const t = String(message || "").trim();

  let m = t.match(/^!l1\s+(.+)/i);
  if (m) return { type: "setLine", line: 1, value: m[1].trim() };

  m = t.match(/^!l2\s+(.+)/i);
  if (m) return { type: "setLine", line: 2, value: m[1].trim() };

  if (/^!clear1$/i.test(t)) return { type: "setLine", line: 1, value: "" };
  if (/^!clear2$/i.test(t)) return { type: "setLine", line: 2, value: "" };

  if (/^!c1$/i.test(t)) return { type: "nextEpisode" };
  if (/^!c2$/i.test(t)) return { type: "nextSeason" };

  m = t.match(/^!ep\s+(\d+)/i);
  if (m) return { type: "setEpisode", value: Number(m[1]) };

  m = t.match(/^!t\s+(\d+)/i);
  if (m) return { type: "setSeason", value: Number(m[1]) };

  m = t.match(/^!j1\s*(?:\(|\s)([^\)\s]+)\)?$/i);
  if (m) return { type: "setColor", line: 1, value: m[1].trim() };

  m = t.match(/^!j2\s*(?:\(|\s)([^\)\s]+)\)?$/i);
  if (m) return { type: "setColor", line: 2, value: m[1].trim() };

  return null;
}

function currentPayload(extra = {}) {
  return {
    type: "state",
    line1: state.line1,
    line2: state.line2,
    color1: state.color1,
    color2: state.color2,
    rainbow1: state.rainbow1,
    rainbow2: state.rainbow2,
    episode: state.episode,
    season: state.season,
    ...extra
  };
}

function emitState(extra = {}) {
  io.emit("overlay_state", currentPayload(extra));
}

function applyCommand(cmd) {
  if (cmd.type === "setLine") {
    if (cmd.line === 1) state.line1 = String(cmd.value).slice(0, 200);
    if (cmd.line === 2) state.line2 = String(cmd.value).slice(0, 200);
    return true;
  }

  if (cmd.type === "nextEpisode") {
    state.episode += 1;
    state.line1 = epText();
    return true;
  }

  if (cmd.type === "nextSeason") {
    state.season += 1;
    state.episode = 1;
    state.line1 = epText();
    return true;
  }

  if (cmd.type === "setEpisode") {
    state.episode = Math.max(1, cmd.value || 1);
    state.line1 = epText();
    return true;
  }

  if (cmd.type === "setSeason") {
    state.season = Math.max(1, cmd.value || 1);
    state.episode = 1;
    state.line1 = epText();
    return true;
  }

  if (cmd.type === "setColor") {
    const v = String(cmd.value || "").toLowerCase().trim();
    const rainbow = v === "colorido" || v === "rainbow";

    if (!rainbow && !isHexColor(v)) return false;

    if (cmd.line === 1) {
      state.rainbow1 = rainbow;
      if (!rainbow) state.color1 = normalizeHex(v);
    }

    if (cmd.line === 2) {
      state.rainbow2 = rainbow;
      if (!rainbow) state.color2 = normalizeHex(v);
    }

    return true;
  }

  return false;
}

function handleChat(platform, username, message, isMod, isBroadcaster) {
  console.log(`[${platform}] ${username}: ${message}`);

  const cmd = parseCommand(message);
  if (!cmd) return;

  if (!isAllowed(platform, username, isMod, isBroadcaster)) {
    console.log(`[${platform}] sem permissão: ${username}`);
    return;
  }

  const ok = applyCommand(cmd);
  if (!ok) {
    console.log(`[${platform}] comando inválido:`, cmd);
    return;
  }

  console.log(`[${platform}] comando aplicado:`, cmd, state);
  emitState({ platform, user: username });
}

app.get("/", (req, res) => res.send("Overlay server online"));

app.get("/state", (req, res) => res.json(currentPayload()));

app.get("/test", (req, res) => {
  const line = Number(req.query.line || 1);
  const text = String(req.query.text || "TESTE").slice(0, 200);
  if (line === 1) state.line1 = text;
  if (line === 2) state.line2 = text;
  emitState({ platform: "test", user: "browser" });
  res.send(`Enviado linha ${line}: ${text}`);
});

io.on("connection", (socket) => {
  console.log("Overlay conectado:", socket.id);
  socket.emit("overlay_state", currentPayload({ platform: "server" }));
  socket.on("disconnect", () => console.log("Overlay desconectado:", socket.id));
});

/* TWITCH */
const twitchClient = new tmi.Client({
  options: { debug: true },
  connection: { reconnect: true, secure: true },
  channels: [TWITCH_CHANNEL]
});

twitchClient.connect()
  .then(() => console.log("Twitch conectado:", TWITCH_CHANNEL))
  .catch(err => console.error("Erro Twitch:", err));

twitchClient.on("message", (channel, userstate, message, self) => {
  if (self) return;
  const username = userstate.username || "";
  const badges = userstate.badges || {};
  const isBroadcaster = Boolean(badges.broadcaster);
  const isMod = Boolean(userstate.mod || badges.moderator);
  handleChat("twitch", username, message, isMod, isBroadcaster);
});

/* KICK */
async function getKickChatroomId(channelName) {
  const url = `https://kick.com/api/v2/channels/${encodeURIComponent(channelName)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    }
  });
  if (!response.ok) throw new Error(`Erro ao buscar canal Kick: ${response.status}`);
  const data = await response.json();
  const id = data?.chatroom?.id || data?.chatroom_id || data?.livestream?.chatroom_id;
  if (!id) throw new Error("Não achei chatroom.id da Kick");
  return id;
}

function parseKickEvent(raw) {
  try {
    const msg = JSON.parse(raw);
    if (msg.event === "pusher:connection_established") return { type: "connected" };
    if (msg.event === "pusher_internal:subscription_succeeded") return { type: "subscribed" };
    if (!String(msg.event || "").includes("ChatMessageEvent")) return null;
    let data = msg.data;
    if (typeof data === "string") data = JSON.parse(data);
    return { type: "chat", data };
  } catch (err) {
    console.error("Erro parseKickEvent:", err.message);
    return null;
  }
}

function extractKickMessage(data) {
  const username = data?.sender?.username || data?.sender?.slug || data?.user?.username || data?.username || "unknown";
  const text = data?.content || data?.message || "";
  const badges = data?.sender?.badges || data?.badges || [];
  const badgesText = JSON.stringify(badges).toLowerCase();
  const isBroadcaster = normalizeUser(username) === normalizeUser(KICK_CHANNEL) || badgesText.includes("broadcaster") || badgesText.includes("host") || badgesText.includes("owner");
  const isMod = badgesText.includes("moderator") || badgesText.includes("mod");
  return { username, text, isMod, isBroadcaster };
}

async function startKick() {
  try {
    const chatroomId = KICK_CHATROOM_ID || await getKickChatroomId(KICK_CHANNEL);
    console.log("Kick chatroom ID:", chatroomId);

    const wsUrl = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false";
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      console.log("Kick WebSocket aberto");
      ws.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${chatroomId}.v2` } }));
    });

    ws.on("message", raw => {
      const parsed = parseKickEvent(raw.toString());
      if (!parsed) return;
      if (parsed.type === "connected") return console.log("Kick conectado:", KICK_CHANNEL);
      if (parsed.type === "subscribed") return console.log("Kick inscrito no chat:", KICK_CHANNEL);
      if (parsed.type === "chat") {
        const info = extractKickMessage(parsed.data);
        handleChat("kick", info.username, info.text, info.isMod, info.isBroadcaster);
      }
    });

    ws.on("close", () => {
      console.log("Kick WebSocket fechado. Reconectando em 5s...");
      setTimeout(startKick, 5000);
    });

    ws.on("error", err => console.error("Erro Kick WebSocket:", err.message));
  } catch (err) {
    console.error("Erro ao iniciar Kick:", err.message);
    setTimeout(startKick, 10000);
  }
}
startKick();

server.listen(PORT, "0.0.0.0", () => console.log(`Servidor rodando na porta ${PORT}`));
