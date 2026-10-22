const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(__dirname));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function cleanName(value) {
  return String(value || "Игрок").trim().slice(0, 18) || "Игрок";
}
function publicPlayers(room) {
  return [...room.players.entries()].map(([id, p]) => ({ id, name: p.name }));
}
function broadcastPlayers(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit("players:update", publicPlayers(room));
}
function roomFor(socket) {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) : null;
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  delete socket.data.roomCode;
  if (!room) return;
  room.players.delete(socket.id);
  io.to(code).emit("player:left", { id: socket.id });
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.id) {
    room.hostId = room.players.keys().next().value;
    io.to(room.hostId).emit("room:host", { isHost: true });
  }
  broadcastPlayers(code);
}
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

io.on("connection", socket => {
  socket.on("room:create", (data, callback) => {
    leaveRoom(socket);
    const code = makeCode();
    const room = {
      hostId: socket.id,
      players: new Map([[socket.id, { name: cleanName(data && data.name), x: 0, z: 0, yaw: 0, alive: true }]]),
      state: null,
      started: false
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    if (typeof callback === "function") callback({ ok: true, code });
    broadcastPlayers(code);
    socket.emit("room:host", { isHost: true });
  });

  socket.on("room:join", (data, callback) => {
    const code = String(data && data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return typeof callback === "function" && callback({ ok: false, error: "Комната не найдена." });
    if (room.players.size >= 4) return typeof callback === "function" && callback({ ok: false, error: "Комната заполнена (максимум 4 игрока)." });
    leaveRoom(socket);
    room.players.set(socket.id, { name: cleanName(data && data.name), x: 0, z: 0, yaw: 0, alive: true });
    socket.join(code);
    socket.data.roomCode = code;
    if (typeof callback === "function") callback({ ok: true, code, state: room.state, started: room.started });
    broadcastPlayers(code);
    socket.to(code).emit("player:joined", { id: socket.id, name: room.players.get(socket.id).name });
    if (room.state) socket.emit("game:state", { state: room.state, hostId: room.hostId });
  });

  socket.on("game:start", state => {
    const room = roomFor(socket);
    if (!room || room.hostId !== socket.id || !state || !Array.isArray(state.grid)) return;
    room.state = state;
    room.started = true;
    io.to(socket.data.roomCode).emit("game:state", { state: room.state, hostId: room.hostId });
  });

  socket.on("game:state", state => {
    const room = roomFor(socket);
    if (!room || room.hostId !== socket.id || !state || !Array.isArray(state.grid)) return;
    room.state = state;
    socket.to(socket.data.roomCode).emit("game:state:update", state);
  });

  socket.on("player:move", data => {
    const room = roomFor(socket);
    if (!room || !data || !Number.isFinite(data.x) || !Number.isFinite(data.z)) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.x = data.x; p.z = data.z; p.yaw = Number(data.yaw) || 0; p.alive = data.alive !== false;
    socket.to(socket.data.roomCode).emit("player:move", { id: socket.id, ...p });
  });

  socket.on("task:complete", data => {
    const room = roomFor(socket);
    if (!room || !room.state || !data || typeof data.taskId !== "string") return;
    const task = (room.state.tasks || []).find(t => t.id === data.taskId);
    if (!task || task.done) return;
    if (task.id === "generator" && !(room.state.tasks || []).some(t => t.id === "fuse" && t.done)) return;
    if (task.id === "chain" && !(room.state.tasks || []).some(t => t.id === "cutters" && t.done)) return;
    task.done = true;
    room.state.exitOpen = (room.state.tasks || []).filter(t => t.required).every(t => t.done);
    io.to(socket.data.roomCode).emit("task:update", {
      tasks: room.state.tasks,
      exitOpen: room.state.exitOpen
    });
    io.to(socket.data.roomCode).emit("game:state:update", room.state);
  });

  socket.on("game:finish", result => {
    const room = roomFor(socket);
    if (!room || !result) return;
    io.to(socket.data.roomCode).emit("game:finish", {
      won: !!result.won,
      message: String(result.message || "").slice(0, 160)
    });
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Don't Look Back multiplayer server listening on ${PORT}`);
});
