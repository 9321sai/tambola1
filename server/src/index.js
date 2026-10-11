import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { generateTicket } from "./ticket.js";

const app = express();
app.use(cors());
app.get("/", (_req, res) => res.send("🎟️ Tambola Madness server is running!"));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ["http://localhost:5173", "http://127.0.0.1:5173"], methods: ["GET", "POST"] },
});

const rooms = new Map();
const DEFAULT_CALL_INTERVAL = 10;
const RECONNECT_GRACE_MS = 120_000;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do { code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""); }
  while (rooms.has(code));
  return code;
}
function stopAutoCaller(room) {
  if (room.callTimer) clearInterval(room.callTimer);
  room.callTimer = null;
}
function sendPlayers(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit("players-updated", {
    players: [...room.players.values()].map(({ id, name, isHost, score, online }) => ({ id, name, isHost, score: score ?? 0, online: online !== false })),
  });
}
function sendRoomSettings(roomCode) {
  const room = rooms.get(roomCode);
  if (room) io.to(roomCode).emit("room-settings", { callInterval: room.callInterval });
}
function finishGame(roomCode, reason) {
  const room = rooms.get(roomCode);
  if (!room || room.finished) return;
  room.finished = true;
  room.paused = true;
  stopAutoCaller(room);
  const results = {
    reason,
    calledCount: room.calledNumbers.length,
    calledNumbers: [...room.calledNumbers],
    prizes: [...room.prizeResults],
    leaderboard: [...room.players.values()]
      .map((player) => ({ id: player.id, name: player.name, score: player.score ?? 0, isHost: player.isHost }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
  };
  io.to(roomCode).emit("game-finished", results);
  sendPlayers(roomCode);
}

function awardPrizes(roomCode, player) {
  const room = rooms.get(roomCode);
  if (!room || !player.ticket || room.finished) return;
  const marked = player.markedNumbers;
  const ticket = player.ticket;
  const award = (key, name, points) => {
    if (room.prizesWon.has(key)) return;
    room.prizesWon.add(key);
    player.score += points;
    room.prizeResults.push({ prize: name, winner: player.name, points, score: player.score });
    io.to(roomCode).emit("prize-won", { prize: name, winner: player.name, points, score: player.score });
    sendPlayers(roomCode);
  };
  if (!room.prizesWon.has("first-number") && marked.size >= 1) {
    room.prizesWon.add("first-number");
    const result = { prize: "First Number", winner: player.name, points: 0, score: player.score };
    room.prizeResults.push(result);
    io.to(roomCode).emit("prize-won", result);
  }
  if (marked.size >= 5) award("first-five", "First Five", 15);
  for (const prize of [{ i: 0, key: "top-line", name: "Top Line" }, { i: 1, key: "middle-line", name: "Middle Line" }, { i: 2, key: "bottom-line", name: "Bottom Line" }]) {
    const row = ticket[prize.i] || [];
    const nums = row.filter((n) => n != null);
    if (nums.length && nums.every((n) => marked.has(n))) award(prize.key, prize.name, 15);
  }
  const allNums = ticket.flat().filter((n) => n != null);
  if (allNums.length && allNums.every((n) => marked.has(n))) award("full-house", "Full House", 40);

  // Six prize categories are available: First Number, First Five, three lines, and Full House.
  if (room.prizesWon.size >= 6) finishGame(roomCode, "all-prizes-awarded");
}
function callNextNumber(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.started || room.paused || room.finished) return;
  if (!room.numberPool.length) {
    stopAutoCaller(room);
    io.to(roomCode).emit("all-numbers-called");
    finishGame(roomCode, "all-numbers-called");
    return;
  }
  const number = room.numberPool.pop();
  room.calledNumbers.push(number);
  room.currentNumber = number;
  io.to(roomCode).emit("number-called", { number });
  if (!room.numberPool.length) {
    stopAutoCaller(room);
    io.to(roomCode).emit("all-numbers-called");
    finishGame(roomCode, "all-numbers-called");
  }
}
function startAutoCaller(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.started || room.paused || room.finished || room.callTimer || !room.numberPool.length) return;
  callNextNumber(roomCode);
  if (room.numberPool.length) room.callTimer = setInterval(() => callNextNumber(roomCode), room.callInterval * 1000);
}
function endPlayerSession(roomCode, playerId, sessionId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player || player.sessionId !== sessionId || player.online) return;
  room.players.delete(playerId);
  if (room.hostId === playerId) {
    const next = [...room.players.values()].find((p) => p.online);
    if (next) {
      room.hostId = next.id;
      next.isHost = true;
    }
  }
  if (!room.players.size) {
    stopAutoCaller(room);
    rooms.delete(roomCode);
    return;
  }
  sendPlayers(roomCode);
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("create-room", ({ playerName, sessionId } = {}) => {
    const name = playerName?.trim();
    if (!name || !sessionId) return socket.emit("room-error", "Enter your name and try again.");
    if (socket.data.roomCode) return socket.emit("room-error", "You are already in a room.");
    const roomCode = generateRoomCode();
    const player = { id: socket.id, sessionId, name: name.slice(0, 20), isHost: true, ticket: null, markedNumbers: new Set(), score: 0, online: true, reconnectTimer: null };
    const room = { hostId: socket.id, players: new Map([[socket.id, player]]), started: false, paused: false, numberPool: [], calledNumbers: [], currentNumber: null, callTimer: null, callInterval: DEFAULT_CALL_INTERVAL, prizesWon: new Set(), prizeResults: [], finished: false, results: null };
    rooms.set(roomCode, room);
    socket.join(roomCode); socket.data.roomCode = roomCode; socket.data.sessionId = sessionId;
    socket.emit("room-created", { roomCode, players: [{ id: socket.id, name: player.name, isHost: true, score: 0, online: true }] });
    sendRoomSettings(roomCode);
  });

  socket.on("join-room", ({ roomCode, playerName, sessionId } = {}) => {
    const name = playerName?.trim(); const code = roomCode?.trim().toUpperCase(); const room = rooms.get(code);
    if (!name || !sessionId) return socket.emit("room-error", "Enter your name and try again.");
    if (socket.data.roomCode) return socket.emit("room-error", "You are already in a room.");
    if (!room) return socket.emit("room-error", "Room not found. Check the room code.");
    if (room.started) return socket.emit("room-error", "This game has already started.");
    if (room.players.size >= 8) return socket.emit("room-error", "This room is full (maximum 8 players).");
    const player = { id: socket.id, sessionId, name: name.slice(0, 20), isHost: false, ticket: null, markedNumbers: new Set(), score: 0, online: true, reconnectTimer: null };
    room.players.set(socket.id, player); socket.join(code); socket.data.roomCode = code; socket.data.sessionId = sessionId;
    socket.emit("room-joined", { roomCode: code }); sendPlayers(code); sendRoomSettings(code);
  });

  socket.on("restore-session", ({ sessionId } = {}) => {
    if (!sessionId || socket.data.roomCode) return;
    for (const [roomCode, room] of rooms) {
      const entry = [...room.players.entries()].find(([, p]) => p.sessionId === sessionId);
      if (!entry) continue;
      const [oldId, player] = entry;
      if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
      room.players.delete(oldId);
      player.id = socket.id; player.online = true; player.reconnectTimer = null;
      room.players.set(socket.id, player);
      if (room.hostId === oldId) room.hostId = socket.id;
      player.isHost = room.hostId === socket.id;
      socket.join(roomCode); socket.data.roomCode = roomCode; socket.data.sessionId = sessionId;
      socket.emit("session-restored", {
        roomCode,
        players: [...room.players.values()].map(({ id, name, isHost, score, online }) => ({ id, name, isHost, score: score ?? 0, online: online !== false })),
        ticket: player.ticket,
        markedNumbers: [...player.markedNumbers],
        calledNumbers: room.calledNumbers,
        currentNumber: room.currentNumber,
        started: room.started,
        paused: room.paused,
        allNumbersCalled: room.started && room.numberPool.length === 0,
        callInterval: room.callInterval,
        gameResults: room.finished ? { reason: room.prizeResults.length >= 6 ? "all-prizes-awarded" : "all-numbers-called", calledCount: room.calledNumbers.length, calledNumbers: [...room.calledNumbers], prizes: [...room.prizeResults], leaderboard: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0, isHost: p.isHost })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) } : null,
      });
      sendPlayers(roomCode); sendRoomSettings(roomCode);
      return;
    }
  });

  socket.on("start-game", () => {
    const roomCode = socket.data.roomCode; const room = rooms.get(roomCode);
    if (!room) return socket.emit("room-error", "Room not found.");
    if (socket.id !== room.hostId) return socket.emit("room-error", "Only the host can start the game.");
    if (room.started) return socket.emit("room-error", "The game has already started.");
    if ([...room.players.values()].filter((p) => p.online).length < 2) return socket.emit("room-error", "At least 2 connected players are needed to start.");
    room.started = true; room.paused = false; room.finished = false; room.prizesWon = new Set(); room.prizeResults = []; room.results = null;
    room.numberPool = Array.from({ length: 90 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    room.calledNumbers = []; room.currentNumber = null;
    for (const player of room.players.values()) {
      player.ticket = generateTicket(); player.markedNumbers = new Set(); player.score = 0;
      if (player.online) io.to(player.id).emit("your-ticket", { ticket: player.ticket });
    }
    io.to(roomCode).emit("game-started"); io.to(roomCode).emit("caller-status", { paused: false }); sendPlayers(roomCode); startAutoCaller(roomCode);
  });

  socket.on("mark-number", ({ number } = {}) => {
    const roomCode = socket.data.roomCode; const room = rooms.get(roomCode); const player = room?.players.get(socket.id);
    if (!room || !room.started || room.finished) return socket.emit("room-error", "The game is not active.");
    if (!player?.ticket) return socket.emit("room-error", "Your ticket was not found.");
    if (!Number.isInteger(number)) return socket.emit("room-error", "Invalid ticket number.");
    const ticketNumbers = player.ticket.flat().filter((n) => n != null);
    if (!ticketNumbers.includes(number)) return socket.emit("room-error", "That number is not on your ticket.");
    if (!room.calledNumbers.includes(number)) return socket.emit("room-error", `Number ${number} has not been called.`);
    if (player.markedNumbers.has(number)) player.markedNumbers.delete(number);
    else { player.markedNumbers.add(number); awardPrizes(roomCode, player); }
    socket.emit("marked-numbers-updated", { markedNumbers: [...player.markedNumbers] });
  });

  socket.on("set-call-interval", ({ seconds } = {}) => {
    const roomCode = socket.data.roomCode; const room = rooms.get(roomCode);
    if (!room) return socket.emit("room-error", "Room not found.");
    if (socket.id !== room.hostId) return socket.emit("room-error", "Only the host can change call speed.");
    const allowed = [3, 5, 10, 15, 20];
    if (!allowed.includes(Number(seconds))) return socket.emit("room-error", "Choose a supported call speed.");
    room.callInterval = Number(seconds);
    if (room.started && !room.paused) { stopAutoCaller(room); if (room.numberPool.length) room.callTimer = setInterval(() => callNextNumber(roomCode), room.callInterval * 1000); }
    sendRoomSettings(roomCode);
  });

  socket.on("leave-room", () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room) {
      socket.data.roomCode = null;
      socket.data.sessionId = null;
      socket.emit("room-left", { message: "Returned to the home screen." });
      return;
    }

    const player = room.players.get(socket.id);
    if (player?.reconnectTimer) clearTimeout(player.reconnectTimer);
    room.players.delete(socket.id);
    socket.leave(roomCode);
    socket.data.roomCode = null;
    socket.data.sessionId = null;

    if (!room.players.size) {
      stopAutoCaller(room);
      rooms.delete(roomCode);
    } else {
      if (room.hostId === socket.id) {
        const next = [...room.players.values()].find((candidate) => candidate.online) || [...room.players.values()][0];
        room.hostId = next.id;
        for (const candidate of room.players.values()) candidate.isHost = candidate.id === next.id;
      }
      sendPlayers(roomCode);
    }

    socket.emit("room-left", { message: "You left the room and returned home." });
  });

  socket.on("kick-player", ({ playerId } = {}) => {
    const roomCode = socket.data.roomCode; const room = rooms.get(roomCode);
    if (!room) return socket.emit("room-error", "Room not found.");
    if (socket.id !== room.hostId) return socket.emit("room-error", "Only the host can remove players.");
    if (!playerId || playerId === room.hostId) return socket.emit("room-error", "You cannot remove the host.");
    const player = room.players.get(playerId);
    if (!player) return socket.emit("room-error", "That player is no longer in the room.");
    if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    io.to(playerId).emit("player-kicked");
    const targetSocket = io.sockets.sockets.get(playerId);
    if (targetSocket) { targetSocket.leave(roomCode); targetSocket.data.roomCode = null; targetSocket.data.sessionId = null; }
    room.players.delete(playerId); sendPlayers(roomCode);
  });

  socket.on("pause-caller", () => {
    const roomCode = socket.data.roomCode; const room = rooms.get(roomCode);
    if (!room || !room.started) return socket.emit("room-error", "The game has not started.");
    if (socket.id !== room.hostId) return socket.emit("room-error", "Only the host can pause calling.");
    if (room.paused) return;
    room.paused = true; stopAutoCaller(room); io.to(roomCode).emit("caller-status", { paused: true });
  });
  socket.on("resume-caller", () => {
    const roomCode = socket.data.roomCode; const room = rooms.get(roomCode);
    if (!room || !room.started) return socket.emit("room-error", "The game has not started.");
    if (socket.id !== room.hostId) return socket.emit("room-error", "Only the host can resume calling.");
    if (!room.paused) return;
    room.paused = false; io.to(roomCode).emit("caller-status", { paused: false }); startAutoCaller(roomCode);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode; const sessionId = socket.data.sessionId;
    const room = rooms.get(roomCode); if (!room) return;
    const player = room.players.get(socket.id); if (!player) return;
    player.online = false;
    player.reconnectTimer = setTimeout(() => endPlayerSession(roomCode, socket.id, sessionId), RECONNECT_GRACE_MS);
    sendPlayers(roomCode);
    console.log("Player temporarily disconnected:", player.name);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Tambola server running on port ${PORT}`));