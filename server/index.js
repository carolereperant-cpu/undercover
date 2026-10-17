'use strict';

/**
 * Couche réseau : Express sert le site, Socket.IO relie les téléphones en temps réel.
 * Toute la logique du jeu est dans game.js ; ici on ne fait que recevoir des événements,
 * appeler game.js, puis renvoyer à CHAQUE joueur sa propre vue filtrée.
 */

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');
const helmet = require('helmet');
const { Server } = require('socket.io');
const game = require('./game');

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

const MAX_ROOMS = 300;
const LOBBY_GRACE_MS = 120_000; // un joueur déconnecté du lobby est retiré après 2 min
const HOST_GRACE_MS = 60_000; // l'hôte déconnecté passe la main après 1 min
const ROOM_IDLE_MS = 30 * 60_000; // salle vide supprimée après 30 min
const ROOM_MAX_AGE_MS = 6 * 60 * 60_000; // aucune salle ne vit plus de 6 h sans activité

const rooms = new Map(); // code -> room
const sessions = new Map(); // socket.id -> { code, playerId }
const graceTimers = new Map(); // "CODE:playerId" -> timeout

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------

const app = express();
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  }),
);

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
  // Toute autre page GET renvoie l'application React (le lien ?salle=ABCD marche ainsi).
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text').send("Le site n'est pas encore construit. Lance : npm run build");
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10_000, // aucun message légitime ne dépasse quelques centaines d'octets
  pingInterval: 10_000,
  pingTimeout: 8_000,
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined,
});

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

/** Envoie à chaque joueur connecté SA vue de la partie (jamais celle des autres). */
function broadcast(room) {
  room.lastActivity = Date.now();
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit('state', game.viewFor(room, p.id));
  }
}

function contextOf(socket) {
  const s = sessions.get(socket.id);
  if (!s) return null;
  const room = rooms.get(s.code);
  if (!room) return null;
  const player = game.getPlayer(room, s.playerId);
  if (!player) return null;
  return { room, player };
}

function attach(socket, room, player) {
  // Si ce joueur était déjà connecté ailleurs (autre onglet), on remplace l'ancienne connexion.
  if (player.socketId && player.socketId !== socket.id) {
    sessions.delete(player.socketId);
    io.to(player.socketId).emit('kicked', { reason: 'Tu t’es connecté depuis un autre appareil.' });
  }
  clearTimeout(graceTimers.get(`${room.code}:${player.id}`));
  game.setConnection(room, player.id, true, socket.id);
  sessions.set(socket.id, { code: room.code, playerId: player.id });
}

function scheduleGrace(room, player) {
  const key = `${room.code}:${player.id}`;
  clearTimeout(graceTimers.get(key));
  const isHost = player.id === room.hostId;
  const timer = setTimeout(() => {
    graceTimers.delete(key);
    if (!rooms.has(room.code) || player.connected) return;
    if (room.phase === 'lobby') game.removePlayer(room, player.id);
    else if (player.id === room.hostId) game.transferHost(room);
    if (room.players.length === 0) rooms.delete(room.code);
    else broadcast(room);
  }, isHost ? HOST_GRACE_MS : LOBBY_GRACE_MS);
  timer.unref?.();
  graceTimers.set(key, timer);
}

/** Limite anti-spam : 25 événements maximum par tranche de 10 secondes et par connexion. */
function makeLimiter() {
  const stamps = [];
  return () => {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > 10_000) stamps.shift();
    if (stamps.length >= 25) return false;
    stamps.push(now);
    return true;
  };
}

// ---------------------------------------------------------------------------
// Événements Socket.IO
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  const allow = makeLimiter();

  /** Enveloppe commune : limite de débit, ack toujours appelé, erreurs attrapées. */
  const on = (event, handler) => {
    socket.on(event, (payload, ack) => {
      const done = typeof ack === 'function' ? ack : () => {};
      if (!allow()) return done({ ok: false, error: 'Doucement, trop de requêtes.' });
      try {
        handler(payload && typeof payload === 'object' ? payload : {}, done);
      } catch (e) {
        console.error(`[${event}]`, e);
        done({ ok: false, error: 'Erreur du serveur.' });
      }
    });
  };

  /** Pour les actions de jeu : retrouve la salle et le joueur, appelle game.js, rediffuse. */
  const action = (event, fn) =>
    on(event, (payload, done) => {
      const c = contextOf(socket);
      if (!c) return done({ ok: false, error: 'Tu n’es dans aucune salle.' });
      const res = fn(c.room, c.player, payload);
      if (res.ok) broadcast(c.room);
      done(res);
    });

  on('room:create', ({ name }, done) => {
    if (contextOf(socket)) return done({ ok: false, error: 'Tu es déjà dans une salle.' });
    if (rooms.size >= MAX_ROOMS) return done({ ok: false, error: 'Le serveur est plein, réessaie plus tard.' });
    const res = game.createRoom((code) => rooms.has(code), name);
    if (!res.ok) return done(res);
    rooms.set(res.room.code, res.room);
    attach(socket, res.room, res.player);
    broadcast(res.room);
    done({ ok: true, code: res.room.code, token: res.player.token });
  });

  on('room:join', ({ code, name }, done) => {
    if (contextOf(socket)) return done({ ok: false, error: 'Tu es déjà dans une salle.' });
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) return done({ ok: false, error: 'Aucune salle avec ce code.' });
    const res = game.addPlayer(room, name);
    if (!res.ok) return done(res);
    attach(socket, room, res.player);
    broadcast(room);
    done({ ok: true, code: room.code, token: res.player.token });
  });

  on('room:rejoin', ({ code, token }, done) => {
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) return done({ ok: false, error: 'Cette salle n’existe plus.' });
    const player = game.findByToken(room, token);
    if (!player) return done({ ok: false, error: 'Tu as été retiré de cette salle.' });
    attach(socket, room, player);
    broadcast(room);
    done({ ok: true, code: room.code });
  });

  on('room:leave', (_payload, done) => {
    const c = contextOf(socket);
    if (!c) return done({ ok: true });
    sessions.delete(socket.id);
    game.setConnection(c.room, c.player.id, false);
    if (c.room.phase === 'lobby') {
      game.removePlayer(c.room, c.player.id);
      if (c.room.players.length === 0) rooms.delete(c.room.code);
      else broadcast(c.room);
    } else {
      // En pleine partie on ne peut pas retirer quelqu'un : il reste "hors ligne" dans la partie.
      if (c.player.id === c.room.hostId) scheduleGrace(c.room, c.player);
      broadcast(c.room);
    }
    done({ ok: true });
  });

  action('host:options', (room, p, payload) => game.setOptions(room, p.id, payload));
  action('host:start', (room, p) => game.startGame(room, p.id));
  action('host:begin', (room, p) => game.beginDiscussion(room, p.id));
  action('host:openVote', (room, p) => game.openVote(room, p.id));
  action('host:closeVote', (room, p) => game.closeVote(room, p.id));
  action('host:next', (room, p) => game.nextRound(room, p.id));
  action('host:rematch', (room, p) => game.rematch(room, p.id));
  action('player:ready', (room, p) => game.markReady(room, p.id));
  action('player:vote', (room, p, { targetId }) => game.castVote(room, p.id, targetId));
  action('detective:investigate', (room, p, { targetId }) => game.investigate(room, p.id, targetId));
  action('white:guess', (room, p, { word }) => game.submitGuess(room, p.id, word));

  on('host:kick', ({ targetId }, done) => {
    const c = contextOf(socket);
    if (!c) return done({ ok: false, error: 'Tu n’es dans aucune salle.' });
    const res = game.kick(c.room, c.player.id, targetId);
    if (!res.ok) return done(res);
    if (res.removed.socketId) {
      sessions.delete(res.removed.socketId);
      io.to(res.removed.socketId).emit('kicked', { reason: 'L’hôte t’a retiré de la salle.' });
    }
    broadcast(c.room);
    done({ ok: true });
  });

  socket.on('disconnect', () => {
    const s = sessions.get(socket.id);
    sessions.delete(socket.id);
    if (!s) return;
    const room = rooms.get(s.code);
    const player = room && game.getPlayer(room, s.playerId);
    if (!player || player.socketId !== socket.id) return;
    game.setConnection(room, player.id, false);
    scheduleGrace(room, player);
    broadcast(room);
  });
});

// Ménage régulier : on supprime les salles abandonnées pour ne pas remplir la mémoire.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const empty = !room.players.some((p) => p.connected);
    if ((empty && now - room.lastActivity > ROOM_IDLE_MS) || now - room.lastActivity > ROOM_MAX_AGE_MS) {
      rooms.delete(code);
    }
  }
}, 5 * 60_000);
sweeper.unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`Undercover prêt sur http://localhost:${PORT}`));
}

module.exports = { server, io, rooms };
