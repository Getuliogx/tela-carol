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

const DEFAULT_COLOR_1 = "#ffffff";
const DEFAULT_COLOR_2 = "#f49dee";

const state = {
  line1: "Filme",
  line2: "Patrocinador",
  ep: 1,
  season: 1,
  line1Style: { mode: "solid", color: DEFAULT_COLOR_1, seed: Date.now() },
  line2Style: { mode: "solid", color: DEFAULT_COLOR_2, seed: Date.now() + 1 }
};

app.get("/", (req, res) => {
  res.send("Overlay server online");
});

app.get("/state", (req, res) => {
  res.json(state);
});

app.get("/test", (req, res) => {
  const line = Number(req.query.line || 1);
  const text = String(req.query.text || "TESTE").slice(0, 200);

  if (line === 1) state.line1 = text;
  if (line === 2) state.line2 = text;

  emitState("test");
  res.send(`Enviado linha ${line}: ${text}`);
});

app.get("/testcolor", (req, res) => {
  const line = Number(req.query.line || 1);
  const value = String(req.query.value || "colorido");
  setColor(line, value);
  emitState("testcolor");
  res.send(`Cor linha ${line}: ${value}`);
});

io.on("connection", (socket) => {
  console.log("Overlay conectado:", socket.id);
  socket.emit("state_update", state);

  socket.on("disconnect", () => {
    console.log("Overlay desconectado:", socket.id);
  });
});

function normalizeUser(user) {
  return String(user || "").toLowerCase().trim();
}

function getAllowedKickUsers() {
  return String(process.env.KICK_ALLOWED_USERS || "")
    .split(",")
    .map(normalizeUser)
    .filter(Boolean);
}

function isHexColor(value) {
  return /^#?[0-9a-f]{6}$/i.test(String(value || "").trim());
}

function normalizeColor(value) {
  const v = String(value || "").trim();
  if (!isHexColor(v)) return null;
  return v.startsWith("#") ? v.toLowerCase() : `#${v.toLowerCase()}`;
}

function cleanCommandArg(value) {
  return String(value || "")
    .trim()
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .trim();
}

function parseCommand(message) {
  const text = String(message || "").trim();

  let m = text.match(/^!l1\s+(.+)/i);
  if (m) return { type: "line", line: 1, value: m[1].trim() };

  m = text.match(/^!l2\s+(.+)/i);
  if (m) return { type: "line", line: 2, value: m[1].trim() };

  if (/^!clear1$/i.test(text)) return { type: "line", line: 1, value: "" };
  if (/^!clear2$/i.test(text)) return { type: "line", line: 2, value: "" };

  if (/^!c1$/i.test(text)) return { type: "nextEp" };
  if (/^!c2$/i.test(text)) return { type: "nextSeason" };

  m = text.match(/^!ep\s+(\d+)/i);
  if (m) return { type: "setEp", value: Number(m[1]) };

  m = text.match(/^!t\s+(\d+)/i);
  if (m) return { type: "setSeason", value: Number(m[1]) };

  m = text.match(/^!j1\s*(?:\(([^)]+)\)|\s+(.+))$/i);
  if (m) return { type: "color", line: 1, value: cleanCommandArg(m[1] || m[2]) };

  m = text.match(/^!j2\s*(?:\(([^)]+)\)|\s+(.+))$/i);
  if (m) return { type: "color", line: 2, value: cleanCommandArg(m[1] || m[2]) };

  return null;
}

function canUseCommand(platform, username, isMod, isBroadcaster) {
  if (isMod || isBroadcaster) return true;

  // A Kick nem sempre entrega badge de mod no websocket público.
  // Por isso os mods da Kick podem ser liberados por variável no Render.
  if (platform === "kick") {
    return getAllowedKickUsers().includes(normalizeUser(username));
  }

  return false;
}

function setLine(line, value) {
  if (line === 1) state.line1 = String(value).slice(0, 200);
  if (line === 2) state.line2 = String(value).slice(0, 200);

  // Se estiver em modo colorido, cada atualização de texto gera cores novas.
  if (line === 1 && state.line1Style.mode === "rainbow") state.line1Style.seed = Date.now() + Math.random();
  if (line === 2 && state.line2Style.mode === "rainbow") state.line2Style.seed = Date.now() + Math.random();
}

function updateEpisodeText() {
  state.line1 = `EP ${state.ep} - T${state.season}`;
  if (state.line1Style.mode === "rainbow") state.line1Style.seed = Date.now() + Math.random();
}

function setColor(line, rawValue) {
  const value = cleanCommandArg(rawValue).toLowerCase();

  if (line === 1) {
    if (value === "reset") {
      state.line1Style = { mode: "solid", color: DEFAULT_COLOR_1, seed: Date.now() };
      return true;
    }
    if (value === "colorido") {
      state.line1Style = { mode: "rainbow", color: DEFAULT_COLOR_1, seed: Date.now() + Math.random() };
      return true;
    }
    const hex = normalizeColor(value);
    if (hex) {
      state.line1Style = { mode: "solid", color: hex, seed: Date.now() };
      return true;
    }
  }

  if (line === 2) {
    if (value === "reset") {
      state.line2Style = { mode: "solid", color: DEFAULT_COLOR_2, seed: Date.now() };
      return true;
    }
    if (value === "colorido") {
      state.line2Style = { mode: "rainbow", color: DEFAULT_COLOR_2, seed: Date.now() + Math.random() };
      return true;
    }
    const hex = normalizeColor(value);
    if (hex) {
      state.line2Style = { mode: "solid", color: hex, seed: Date.now() };
      return true;
    }
  }

  return false;
}

function emitState(reason) {
  console.log("Estado enviado:", reason, state);
  io.emit("state_update", state);
}

function handleCommand(platform, username, message, isMod, isBroadcaster) {
  console.log(`[${platform}] ${username}: ${message}`);

  const cmd = parseCommand(message);
  if (!cmd) return;

  if (!canUseCommand(platform, username, isMod, isBroadcaster)) {
    console.log(`[${platform}] sem permissão: ${username}`);
    return;
  }

  if (cmd.type === "line") {
    setLine(cmd.line, cmd.value);
    emitState(`${platform}:linha${cmd.line}`);
    return;
  }

  if (cmd.type === "nextEp") {
    state.ep += 1;
    updateEpisodeText();
    emitState(`${platform}:c1`);
    return;
  }

  if (cmd.type === "nextSeason") {
    state.season += 1;
    state.ep = 1;
    updateEpisodeText();
    emitState(`${platform}:c2`);
    return;
  }

  if (cmd.type === "setEp") {
    if (Number.isFinite(cmd.value) && cmd.value >= 1) {
      state.ep = cmd.value;
      updateEpisodeText();
      emitState(`${platform}:ep`);
    }
    return;
  }

  if (cmd.type === "setSeason") {
    if (Number.isFinite(cmd.value) && cmd.value >= 1) {
      state.season = cmd.value;
      updateEpisodeText();
      emitState(`${platform}:temporada`);
    }
    return;
  }

  if (cmd.type === "color") {
    const ok = setColor(cmd.line, cmd.value);
    if (ok) emitState(`${platform}:j${cmd.line}`);
    return;
  }
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

  handleCommand("twitch", username, message, isMod, isBroadcaster);
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
    console.error("Erro parseKickEvent:", err.message);
    return null;
  }
}

function extractKickMessage(data) {
  const username = data?.sender?.username || data?.sender?.slug || data?.user?.username || data?.username || "unknown";
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

  const isMod =
    badgesText.includes("moderator") ||
    badgesText.includes("mod");

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
        handleCommand("kick", info.username, info.text, info.isMod, info.isBroadcaster);
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
