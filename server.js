const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const tmi = require("tmi.js");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || "carolinaporto";
const KICK_CHANNEL = process.env.KICK_CHANNEL || "carolinaporto";
const KICK_CHATROOM_ID = process.env.KICK_CHATROOM_ID || "";

const DEFAULT_LINE1_COLOR = "#ffffff";
const DEFAULT_LINE2_COLOR = "#f49dee";

const state = {
  line1: "EP 1 - T1",
  line2: "Patrocinador",
  ep: 1,
  season: 1,
  showSeason: true,
  style1: { mode: "solid", color: DEFAULT_LINE1_COLOR, seed: Date.now() },
  style2: { mode: "solid", color: DEFAULT_LINE2_COLOR, seed: Date.now() + 1 }
};

app.get("/", (req, res) => res.send("Overlay server online"));
app.get("/state", (req, res) => res.json(state));

app.get("/test", (req, res) => {
  const line = Number(req.query.line || 1);
  const text = String(req.query.text || "TESTE").slice(0, 200);
  updateLine(line, text);
  res.send(`Enviado linha ${line}: ${text}`);
});

io.on("connection", (socket) => {
  console.log("Overlay conectado:", socket.id);
  sendFullState(socket);
  socket.on("disconnect", () => console.log("Overlay desconectado:", socket.id));
});

function normalizeUser(user) {
  return String(user || "").toLowerCase().trim();
}

function getKickAllowedUsers() {
  return String(process.env.KICK_ALLOWED_USERS || "")
    .split(",")
    .map(u => normalizeUser(u))
    .filter(Boolean);
}

function canUseCommand(platform, username, isMod, isBroadcaster) {
  if (isMod || isBroadcaster) return true;
  if (platform === "kick") return getKickAllowedUsers().includes(normalizeUser(username));
  return false;
}

function safeText(value) {
  return String(value || "").slice(0, 200);
}

function normalizeHex(value) {
  const v = String(value || "").trim();
  const m = v.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  return "#" + m[1].toLowerCase();
}

function parseEpSeason(text) {
  const t = String(text || "").trim();

  const epMatch =
    t.match(/\bEP\.?\s*(\d+)\b/i) ||
    (t.match(/^\d+$/) ? t.match(/^(\d+)$/) : null);

  const seasonMatch =
    t.match(/\bT(?:EMPORADA)?\.?\s*(\d+)\b/i) ||
    t.match(/\bTEMPORADA\s*(\d+)\b/i);

  if (!epMatch && !seasonMatch) return null;

  return {
    ep: epMatch ? Math.max(1, parseInt(epMatch[1], 10)) : state.ep,
    season: seasonMatch ? Math.max(1, parseInt(seasonMatch[1], 10)) : state.season,
    hasSeasonInText: Boolean(seasonMatch)
  };
}

function epText() {
  return state.showSeason ? `EP ${state.ep} - T${state.season}` : `EP ${state.ep}`;
}

function sendFullState(target = io) {
  target.emit("full_state", {
    line1: state.line1,
    line2: state.line2,
    style1: state.style1,
    style2: state.style2,
    ep: state.ep,
    season: state.season,
    showSeason: state.showSeason
  });
}

function emitLine(line) {
  const payload = {
    line,
    text: line === 1 ? state.line1 : state.line2,
    style: line === 1 ? state.style1 : state.style2
  };

  io.emit("chat_message", payload);
  console.log("Overlay atualizado:", payload);
}

function emitStyle(line) {
  io.emit("style_update", {
    line,
    style: line === 1 ? state.style1 : state.style2
  });
}

function updateLine(line, text) {
  const value = safeText(text);

  if (line === 1) {
    state.line1 = value || epText();

    const parsed = parseEpSeason(state.line1);
    if (parsed) {
      state.ep = parsed.ep;
      state.season = parsed.season;

      // CORREÇÃO PRINCIPAL:
      // Se o !l1 veio sem T, não mostra "- T".
      // Se o !l1 veio com T, mostra "- T".
      state.showSeason = parsed.hasSeasonInText;

      state.line1 = epText();
    }

    if (state.style1.mode === "rainbow") state.style1.seed = Date.now();
  }

  if (line === 2) {
    state.line2 = value;
    if (state.style2.mode === "rainbow") state.style2.seed = Date.now();
  }

  emitLine(line);
}

function updateStyle(line, rawValue) {
  const value = String(rawValue || "").trim().replace(/^\((.*)\)$/u, "$1").trim();
  const lower = value.toLowerCase();

  const styleKey = line === 1 ? "style1" : "style2";
  const defaultColor = line === 1 ? DEFAULT_LINE1_COLOR : DEFAULT_LINE2_COLOR;

  if (lower === "reset") {
    state[styleKey] = { mode: "solid", color: defaultColor, seed: Date.now() };
    emitStyle(line);
    emitLine(line);
    return;
  }

  if (lower === "colorido" || lower === "rainbow") {
    state[styleKey] = {
      mode: "rainbow",
      color: defaultColor,
      seed: Date.now() + Math.floor(Math.random() * 999999)
    };
    emitStyle(line);
    emitLine(line);
    return;
  }

  const hex = normalizeHex(value);
  if (hex) {
    state[styleKey] = { mode: "solid", color: hex, seed: Date.now() };
    emitStyle(line);
    emitLine(line);
    return;
  }

  console.log("Cor inválida:", rawValue);
}

function parseCommand(message) {
  const text = String(message || "").trim();

  let m = text.match(/^!l1\s+(.+)/i);
  if (m) return { type: "line", line: 1, value: m[1].trim() };

  m = text.match(/^!l2\s+(.+)/i);
  if (m) return { type: "line", line: 2, value: m[1].trim() };

  if (/^!clear1$/i.test(text)) return { type: "line", line: 1, value: "" };
  if (/^!clear2$/i.test(text)) return { type: "line", line: 2, value: "" };

  if (/^!c1$/i.test(text)) return { type: "counter_ep" };
  if (/^!c2$/i.test(text)) return { type: "counter_season" };

  m = text.match(/^!ep\s+(\d+)/i);
  if (m) return { type: "set_ep", value: parseInt(m[1], 10) };

  m = text.match(/^!t\s+(\d+)/i);
  if (m) return { type: "set_season", value: parseInt(m[1], 10) };

  m = text.match(/^!j1\s*(?:\((.*?)\)|\s+(.+))$/i);
  if (m) return { type: "style", line: 1, value: (m[1] || m[2] || "").trim() };

  m = text.match(/^!j2\s*(?:\((.*?)\)|\s+(.+))$/i);
  if (m) return { type: "style", line: 2, value: (m[1] || m[2] || "").trim() };

  return null;
}

function runCommand(platform, username, message, isMod, isBroadcaster) {
  console.log(`[${platform}] ${username}: ${message}`);

  const cmd = parseCommand(message);
  if (!cmd) return;

  if (!canUseCommand(platform, username, isMod, isBroadcaster)) {
    console.log(`[${platform}] sem permissão: ${username}`);
    return;
  }

  if (cmd.type === "line") {
    updateLine(cmd.line, cmd.value);
    return;
  }

  if (cmd.type === "counter_ep") {
    state.ep = Math.max(1, Number(state.ep || 1)) + 1;
    state.line1 = epText();
    if (state.style1.mode === "rainbow") state.style1.seed = Date.now();
    emitLine(1);
    return;
  }

  if (cmd.type === "counter_season") {
    state.season = Math.max(1, Number(state.season || 1)) + 1;
    state.ep = 1;
    state.line1 = epText();
    if (state.style1.mode === "rainbow") state.style1.seed = Date.now();
    emitLine(1);
    return;
  }

  if (cmd.type === "set_ep") {
    state.ep = Math.max(1, Number(cmd.value || 1));
    state.line1 = epText();
    if (state.style1.mode === "rainbow") state.style1.seed = Date.now();
    emitLine(1);
    return;
  }

  if (cmd.type === "set_season") {
    state.season = Math.max(1, Number(cmd.value || 1));
    state.line1 = epText();
    if (state.style1.mode === "rainbow") state.style1.seed = Date.now();
    emitLine(1);
    return;
  }

  if (cmd.type === "style") updateStyle(cmd.line, cmd.value);
}

/* TWITCH */

const twitchClient = new tmi.Client({
  options: { debug: true },
  connection: { reconnect: true, secure: true },
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

  runCommand("twitch", username, message, isMod, isBroadcaster);
});

/* KICK SEM PUPPETEER */

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
  const chatroomId = data?.chatroom?.id || data?.chatroom_id || data?.livestream?.chatroom_id;

  if (!chatroomId) throw new Error("Não achei chatroom.id da Kick");

  return chatroomId;
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

  const text = data?.content || data?.message || "";

  const badges = data?.sender?.badges || data?.badges || [];
  const badgesText = JSON.stringify(badges).toLowerCase();
  const userLower = normalizeUser(username);
  const channelLower = normalizeUser(KICK_CHANNEL);

  const isBroadcaster =
    userLower === channelLower ||
    badgesText.includes("broadcaster") ||
    badgesText.includes("host") ||
    badgesText.includes("owner");

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
      ws.send(JSON.stringify({
        event: "pusher:subscribe",
        data: { auth: "", channel: `chatrooms.${chatroomId}.v2` }
      }));
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
        runCommand("kick", info.username, info.text, info.isMod, info.isBroadcaster);
      }
    });

    ws.on("close", () => {
      console.log("Kick WebSocket fechado. Reconectando em 5s...");
      setTimeout(startKick, 5000);
    });

    ws.on("error", (err) => console.error("Erro Kick WebSocket:", err.message));
  } catch (err) {
    console.error("Erro ao iniciar Kick:", err.message);
    setTimeout(startKick, 10000);
  }
}

startKick();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
