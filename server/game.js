'use strict';

/**
 * Logique du jeu Undercover : AUCUNE dépendance réseau ici.
 * Ce fichier ne connaît ni Express ni Socket.IO, ce qui permet de le tester seul
 * (voir server/game.test.js) et de brancher n'importe quelle couche réseau dessus.
 *
 * Toutes les fonctions qui modifient la partie renvoient { ok: true, ... } ou { ok: false, error }.
 */

const crypto = require('node:crypto');
const { THEMES, THEME_IDS } = require('./words');
const { MINI, metaOf } = require('./minigames');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const NAME_MAX = 16;
const WORD_MAX = 30;

const ROLE = Object.freeze({
  CIVIL: 'civil',
  UNDERCOVER: 'undercover',
  MRWHITE: 'mrwhite',
  SHIELD: 'bouclier',
  DETECTIVE: 'detective',
});

const { ok, err, shuffle, cleanText, sameWord, wordKey } = require('./common');

/** Le camp d'un rôle : les infiltrés (Undercover, Mr White) contre les civils (tous les autres). */
const campOf = (role) => (role === ROLE.UNDERCOVER || role === ROLE.MRWHITE ? 'infiltres' : 'civils');

// ---------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Répartition des rôles
// ---------------------------------------------------------------------------

/**
 * Combien de joueurs pour chaque rôle, selon le nombre de joueurs et les options de l'hôte.
 * Règle : les civils sont toujours plus nombreux que les infiltrés.
 */
function rolePlan(n, options = {}) {
  const opt = { mrwhite: true, shield: true, detective: true, ...options };
  const undercover = n >= 9 ? 2 : 1;
  const mrwhite = opt.mrwhite && n >= 5 ? 1 : 0;
  const bouclier = opt.shield && n >= 6 ? 1 : 0;
  const detective = opt.detective && n >= 7 ? 1 : 0;
  const civil = n - undercover - mrwhite - bouclier - detective;
  return { civil, undercover, mrwhite, bouclier, detective };
}

function planToRoles(plan) {
  const roles = [];
  for (const [role, count] of Object.entries(plan)) {
    for (let i = 0; i < count; i++) roles.push(role);
  }
  return roles;
}

// ---------------------------------------------------------------------------
// Salles et joueurs
// ---------------------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // sans I, L, O (faciles à confondre avec 1 et 0)

function generateCode(isTaken) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!isTaken(code)) return code;
  }
  return null;
}

function makePlayer(name, ownerId = null) {
  return {
    id: crypto.randomBytes(4).toString('hex'), // public : sert à désigner un joueur (vote…)
    token: ownerId ? null : crypto.randomUUID(), // SECRET : sert à se reconnecter, n'est jamais envoyé aux autres
    ownerId, // joueur invité : l'id du joueur qui le fait jouer sur son écran (sinon null)
    name,
    socketId: null,
    connected: false,
    alive: true,
    role: null,
    word: null,
    ready: false,
    shieldUsed: false,
    revealed: null, // rôle rendu public (élimination ou bouclier activé)
    investigation: null,
  };
}

function getPlayer(room, id) {
  return room.players.find((p) => p.id === id) || null;
}

/** Un joueur invité est "en ligne" tant que son propriétaire l'est. */
function isOnline(room, p) {
  if (p.ownerId) {
    const owner = getPlayer(room, p.ownerId);
    return Boolean(owner && owner.connected);
  }
  return p.connected;
}

const guestsOf = (room, ownerId) => room.players.filter((p) => p.ownerId === ownerId);

function findByToken(room, token) {
  if (typeof token !== 'string') return null;
  return room.players.find((p) => p.token === token) || null;
}

function createRoom(isTaken, hostName, gameType = 'undercover') {
  const meta = metaOf(gameType);
  if (!meta) return err('Jeu inconnu.');
  const name = cleanText(hostName, NAME_MAX);
  if (!name) return err('Choisis un pseudo.');
  const code = generateCode(isTaken);
  if (!code) return err('Impossible de créer une salle, réessaie.');
  const host = makePlayer(name);
  const room = {
    code,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    phase: 'lobby',
    hostId: host.id,
    players: [host],
    gameType,
    minPlayers: meta.min,
    maxPlayers: meta.max,
    noGuests: Boolean(meta.noGuests),
    mg: null, // l'état d'un mini-jeu (voir server/minigames/)
    options: { mrwhite: true, shield: true, detective: true, showTheme: false, paper: false, themes: [...THEME_IDS] },
    usedPairs: new Set(),
    game: null,
  };
  return ok({ room, player: host });
}

function addPlayer(room, rawName) {
  if (room.phase !== 'lobby') return err('La partie a déjà commencé.');
  if (room.players.length >= room.maxPlayers) return err(`La salle est pleine (${room.maxPlayers} joueurs maximum).`);
  const name = cleanText(rawName, NAME_MAX);
  if (!name) return err('Choisis un pseudo.');
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return err('Ce pseudo est déjà pris dans la salle.');
  }
  const player = makePlayer(name);
  room.players.push(player);
  return ok({ player });
}

const MAX_GUESTS_PER_PLAYER = 3;

/**
 * Ajoute un joueur "sur l'écran" de ownerId (un enfant sans smartphone, par exemple).
 * Il n'a ni jeton ni connexion : c'est son propriétaire qui agit pour lui.
 */
function addGuest(room, ownerId, rawName) {
  if (room.phase !== 'lobby') return err('La partie a déjà commencé.');
  if (room.noGuests) return err('Ce jeu se joue à deux, chacun sur son téléphone.');
  const owner = getPlayer(room, ownerId);
  if (!owner || owner.ownerId) return err('Joueur introuvable.');
  if (guestsOf(room, ownerId).length >= MAX_GUESTS_PER_PLAYER) {
    return err(`Tu peux faire jouer ${MAX_GUESTS_PER_PLAYER} personnes sur ton écran au maximum.`);
  }
  if (room.players.length >= room.maxPlayers) return err(`La salle est pleine (${room.maxPlayers} joueurs maximum).`);
  const name = cleanText(rawName, NAME_MAX);
  if (!name) return err('Choisis un prénom.');
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return err('Ce prénom est déjà pris dans la salle.');
  }
  const guest = makePlayer(name, ownerId);
  room.players.push(guest);
  return ok({ player: guest });
}

function removeGuest(room, ownerId, guestId) {
  if (room.phase !== 'lobby') return err('Impossible en cours de partie.');
  const guest = getPlayer(room, guestId);
  if (!guest || guest.ownerId !== ownerId) return err('Ce joueur n’est pas sur ton écran.');
  room.players = room.players.filter((p) => p.id !== guestId);
  return ok();
}

/** Le nouvel hôte est toujours un vrai joueur (jamais un invité), de préférence connecté. */
function transferHost(room) {
  const real = room.players.filter((p) => !p.ownerId && p.id !== room.hostId);
  const next = real.find((p) => p.connected) || real[0];
  if (next) room.hostId = next.id;
}

/** Retire un joueur (lobby uniquement). Si c'était l'hôte, on passe la main. */
function removePlayer(room, playerId) {
  if (room.phase !== 'lobby') return err('Impossible de retirer un joueur en cours de partie.');
  const wasHost = room.hostId === playerId;
  // Retirer un joueur retire aussi ceux qui jouaient sur son écran.
  room.players = room.players.filter((p) => p.id !== playerId && p.ownerId !== playerId);
  if (wasHost && room.players.length > 0) transferHost(room);
  return ok();
}

function kick(room, actorId, targetId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut retirer un joueur.');
  if (room.phase !== 'lobby') return err('On ne peut retirer un joueur qu’avant le début de la partie.');
  if (targetId === actorId) return err('Tu ne peux pas te retirer toi-même.');
  const target = getPlayer(room, targetId);
  if (!target) return err('Joueur introuvable.');
  removePlayer(room, targetId);
  return ok({ removed: target });
}

function setConnection(room, playerId, connected, socketId = null) {
  const p = getPlayer(room, playerId);
  if (!p) return;
  p.connected = connected;
  p.socketId = connected ? socketId : null;
}

function setOptions(room, actorId, patch) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut changer les options.');
  if (room.phase !== 'lobby') return err('Les options ne se changent qu’avant la partie.');
  // On valide les thèmes avant de modifier quoi que ce soit : tout ou rien.
  let themes = null;
  if (patch && 'themes' in patch) {
    if (!Array.isArray(patch.themes)) return err('Thèmes invalides.');
    themes = THEME_IDS.filter((id) => patch.themes.includes(id)); // ignore les ids inconnus, garde l'ordre officiel
    if (themes.length === 0) return err('Choisis au moins un thème.');
  }
  for (const key of ['mrwhite', 'shield', 'detective', 'showTheme', 'paper']) {
    if (typeof patch?.[key] === 'boolean') room.options[key] = patch[key];
  }
  if (themes) room.options.themes = themes;
  return ok();
}

// ---------------------------------------------------------------------------
// Déroulement d'une partie
// ---------------------------------------------------------------------------

function choosePair(room) {
  // Toutes les paires des thèmes cochés, chacune repérée par une clé "thème:numéro".
  const chosen = THEMES.filter((t) => room.options.themes.includes(t.id));
  const pool = chosen.flatMap((t) => t.pairs.map((pair, index) => ({ theme: t, pair, key: `${t.id}:${index}` })));
  let fresh = pool.filter((entry) => !room.usedPairs.has(entry.key));
  if (fresh.length === 0) {
    // Tout a été joué dans ces thèmes : on repart de zéro pour eux (sans toucher aux autres).
    pool.forEach((entry) => room.usedPairs.delete(entry.key));
    fresh = pool;
  }
  const entry = fresh[crypto.randomInt(fresh.length)];
  room.usedPairs.add(entry.key);
  const [a, b] = entry.pair;
  const words = crypto.randomInt(2) === 0 ? { civilWord: a, undercoverWord: b } : { civilWord: b, undercoverWord: a };
  return { ...words, theme: entry.theme.id };
}

function startGame(room, actorId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut lancer la partie.');
  if (room.phase !== 'lobby') return err('La partie est déjà lancée.');
  const n = room.players.length;
  if (n < room.minPlayers) return err(`Il faut au moins ${room.minPlayers} joueurs pour commencer.`);
  if (n > room.maxPlayers) return err(`${room.maxPlayers} joueurs maximum.`);
  if (room.gameType !== 'undercover') {
    MINI[room.gameType].init(room);
    room.phase = 'playing';
    return ok();
  }

  const { civilWord, undercoverWord, theme } = choosePair(room);
  const roles = shuffle(planToRoles(rolePlan(n, room.options)));
  room.players.forEach((p, i) => {
    p.role = roles[i];
    p.word = p.role === ROLE.MRWHITE ? null : p.role === ROLE.UNDERCOVER ? undercoverWord : civilWord;
    p.alive = true;
    p.ready = false;
    p.shieldUsed = false;
    p.revealed = null;
    p.investigation = null;
  });
  room.game = {
    round: 1,
    civilWord,
    undercoverWord,
    theme,
    order: [],
    votes: {},
    candidates: null,
    tiebreak: false,
    result: null,
    guessFor: null,
    winner: null,
    reason: null,
  };
  room.phase = 'reveal';
  return ok();
}

function markReady(room, playerId) {
  if (room.phase !== 'reveal') return err('Ce n’est pas le moment.');
  const p = getPlayer(room, playerId);
  if (!p) return err('Joueur introuvable.');
  p.ready = true;
  if (room.players.every((x) => x.ready)) startDiscussion(room);
  return ok();
}

/** Ordre de parole : aléatoire, mais Mr White ne parle jamais en premier (il n'a aucun indice). */
function buildOrder(room) {
  const alive = shuffle(room.players.filter((p) => p.alive));
  if (alive.length > 1 && alive[0].role === ROLE.MRWHITE) {
    const k = 1 + crypto.randomInt(alive.length - 1);
    [alive[0], alive[k]] = [alive[k], alive[0]];
  }
  return alive.map((p) => p.id);
}

function startDiscussion(room) {
  const g = room.game;
  g.order = buildOrder(room);
  g.votes = {};
  g.candidates = null;
  g.tiebreak = false;
  g.result = null;
  room.phase = 'discussion';
}

function beginDiscussion(room, actorId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut lancer la discussion.');
  if (room.phase !== 'reveal') return err('Ce n’est pas le moment.');
  startDiscussion(room);
  return ok();
}

function openVote(room, actorId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut ouvrir le vote.');
  if (room.phase !== 'discussion') return err('Ce n’est pas le moment.');
  const g = room.game;
  g.votes = {};
  g.candidates = null;
  g.tiebreak = false;
  room.phase = 'vote';
  return ok();
}

function castVote(room, voterId, targetId) {
  if (room.phase !== 'vote') return err('Le vote n’est pas ouvert.');
  const voter = getPlayer(room, voterId);
  if (!voter || !voter.alive) return err('Tu ne peux pas voter.');
  const target = getPlayer(room, targetId);
  if (!target || !target.alive) return err('Joueur invalide.');
  if (target.id === voter.id) return err('Tu ne peux pas voter pour toi-même.');
  const g = room.game;
  if (g.candidates && !g.candidates.includes(target.id)) return err('Ce joueur n’est pas dans le second tour.');
  g.votes[voter.id] = target.id;
  if (room.players.filter((p) => p.alive).every((p) => g.votes[p.id])) resolveVote(room);
  return ok();
}

function closeVote(room, actorId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut clôturer le vote.');
  if (room.phase !== 'vote') return err('Le vote n’est pas ouvert.');
  resolveVote(room);
  return ok();
}

function buildTally(room, counts) {
  return Object.entries(counts)
    .map(([id, votes]) => ({ id, name: getPlayer(room, id)?.name ?? '?', votes }))
    .sort((a, b) => b.votes - a.votes);
}

function resolveVote(room) {
  const g = room.game;
  const counts = {};
  for (const target of Object.values(g.votes)) counts[target] = (counts[target] || 0) + 1;
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    g.result = { type: 'none', tally: [] };
    room.phase = 'result';
    return;
  }
  const max = Math.max(...entries.map(([, c]) => c));
  const top = entries.filter(([, c]) => c === max).map(([id]) => id);

  if (top.length === 1) {
    eliminate(room, top[0], counts);
  } else if (!g.tiebreak) {
    // Première égalité : on revote, mais seulement entre les ex æquo.
    g.tiebreak = true;
    g.candidates = top;
    g.votes = {};
  } else {
    // Deuxième égalité : personne n'est éliminé.
    g.result = { type: 'tie', tiedNames: top.map((id) => getPlayer(room, id)?.name ?? '?'), tally: buildTally(room, counts) };
    room.phase = 'result';
  }
}

function eliminate(room, targetId, counts) {
  const g = room.game;
  const p = getPlayer(room, targetId);
  const tally = buildTally(room, counts);

  // Le Bouclier encaisse le premier vote contre lui.
  if (p.role === ROLE.SHIELD && !p.shieldUsed) {
    p.shieldUsed = true;
    p.revealed = ROLE.SHIELD;
    g.result = { type: 'saved', playerId: p.id, playerName: p.name, role: ROLE.SHIELD, tally };
    room.phase = 'result';
    return;
  }

  p.alive = false;
  p.revealed = p.role;
  g.result = { type: 'eliminated', playerId: p.id, playerName: p.name, role: p.role, camp: campOf(p.role), tally };

  if (p.role === ROLE.MRWHITE) {
    // Mr White démasqué a une dernière chance : deviner le mot des civils.
    g.guessFor = p.id;
    room.phase = 'whiteGuess';
    return;
  }
  afterElimination(room);
}

function checkWin(room) {
  const alive = room.players.filter((p) => p.alive);
  const infiltres = alive.filter((p) => campOf(p.role) === 'infiltres').length;
  const civils = alive.length - infiltres;
  if (infiltres === 0) return 'civils';
  if (infiltres >= civils) return 'infiltres';
  return null;
}

function afterElimination(room) {
  const winner = checkWin(room);
  if (winner) endGame(room, winner, 'elimination');
  else room.phase = 'result';
}

function endGame(room, winner, reason) {
  room.game.winner = winner;
  room.game.reason = reason;
  room.game.guessFor = null;
  room.phase = 'end';
}

function submitGuess(room, playerId, word) {
  if (room.phase !== 'whiteGuess') return err('Ce n’est pas le moment.');
  const g = room.game;
  if (g.guessFor !== playerId) return err('Ce n’est pas à toi de deviner.');
  const text = cleanText(word, WORD_MAX);
  if (!text) return err('Écris un mot.');
  const correct = sameWord(text, g.civilWord);
  g.result.guess = { text, correct };
  g.guessFor = null;
  if (correct) endGame(room, 'mrwhite', 'guess');
  else afterElimination(room);
  return ok({ correct });
}

function nextRound(room, actorId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut lancer la manche suivante.');
  if (room.phase !== 'result') return err('Ce n’est pas le moment.');
  room.game.round += 1;
  startDiscussion(room);
  return ok();
}

/** Pouvoir du Détective : une fois par partie, savoir si un joueur a le même mot que soi. */
function investigate(room, playerId, targetId) {
  if (room.phase !== 'discussion' && room.phase !== 'vote') return err('Tu ne peux pas enquêter maintenant.');
  const me = getPlayer(room, playerId);
  if (!me || me.role !== ROLE.DETECTIVE) return err('Tu n’es pas le Détective.');
  if (!me.alive) return err('Tu es éliminé.');
  if (me.investigation) return err('Tu as déjà utilisé ton enquête.');
  const target = getPlayer(room, targetId);
  if (!target || !target.alive) return err('Joueur invalide.');
  if (target.id === me.id) return err('Choisis un autre joueur.');
  const same = target.word !== null && target.word === me.word;
  me.investigation = { targetId: target.id, targetName: target.name, same };
  return ok();
}

/** Une action de mini-jeu (voir server/minigames/). L'acteur est un joueur ou un invité de l'expéditeur. */
function miniAct(room, actor, payload) {
  if (room.gameType === 'undercover') return err('Action inconnue.');
  const type = typeof payload?.type === 'string' ? payload.type : '';
  return MINI[room.gameType].act(room, actor, type, payload);
}

function rematch(room, actorId) {
  if (room.hostId !== actorId) return err('Seul l’hôte peut relancer une partie.');
  if (room.phase !== 'end') return err('La partie n’est pas terminée.');
  if (room.gameType !== 'undercover') room.mg = null;
  room.players = room.players.filter((p) => isOnline(room, p) || p.id === room.hostId);
  if (!getPlayer(room, room.hostId)?.connected) transferHost(room);
  for (const p of room.players) {
    p.alive = true;
    p.role = null;
    p.word = null;
    p.ready = false;
    p.shieldUsed = false;
    p.revealed = null;
    p.investigation = null;
  }
  room.game = null;
  room.phase = 'lobby';
  return ok();
}

// ---------------------------------------------------------------------------
// Ce que chaque joueur a le droit de voir
// ---------------------------------------------------------------------------

/** Ce qu'un joueur a le droit de savoir sur lui-même (l'Undercover se croit civil). */
function secretFor(p, phase) {
  return {
    alive: p.alive,
    role: p.role === ROLE.UNDERCOVER ? ROLE.CIVIL : p.role,
    word: p.word,
    shieldUsed: p.shieldUsed,
    investigation: p.investigation,
    canInvestigate:
      p.role === ROLE.DETECTIVE && p.alive && !p.investigation && (phase === 'discussion' || phase === 'vote'),
  };
}

function didWin(role, winner) {
  if (winner === 'mrwhite') return role === ROLE.MRWHITE;
  return campOf(role) === (winner === 'infiltres' ? 'infiltres' : 'civils');
}

/**
 * Construit la vue d'un joueur précis. C'est LE point de sécurité du jeu :
 * le serveur n'envoie jamais le mot ni le rôle des autres joueurs avant la fin de partie.
 * L'Undercover, lui, croit être un civil : on lui envoie donc le rôle "civil".
 */
function viewFor(room, playerId) {
  const me = getPlayer(room, playerId);
  const g = room.game;
  const phase = room.phase;
  const aliveList = room.players.filter((p) => p.alive);

  const view = {
    code: room.code,
    phase,
    round: g ? g.round : 0,
    hostId: room.hostId,
    meId: playerId,
    paper: Boolean(room.options.paper),
    limits: { min: room.minPlayers, max: room.maxPlayers },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      guest: Boolean(p.ownerId),
      ownerId: p.ownerId,
      alive: p.alive,
      connected: isOnline(room, p),
      isHost: p.id === room.hostId,
      ready: p.ready,
      revealed: p.revealed,
      voted: phase === 'vote' && Boolean(g.votes[p.id]),
    })),
  };

  if (room.gameType !== 'undercover') {
    view.gameType = room.gameType;
    view.game = metaOf(room.gameType);
    view.noGuests = room.noGuests;
  }

  // Mini-jeux : chacun reçoit sa propre vue, et le propriétaire reçoit aussi celle de ses invités.
  if (room.gameType !== 'undercover') {
    const mod = MINI[room.gameType];
    // Certains jeux (le quiz) utilisent les thèmes choisis par l'hôte dans la salle d'attente.
    if (phase === 'lobby' && mod.meta.themes) {
      view.options = { themes: [...room.options.themes] };
      view.themes = THEMES.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, count: mod.themeCount(t.id) }));
    }
    if (phase !== 'lobby') {
      view.mg = mod.view(room, playerId);
      const mine = guestsOf(room, playerId);
      if (mine.length > 0) view.mgGuests = Object.fromEntries(mine.map((guest) => [guest.id, mod.view(room, guest.id)]));
    }
    return view;
  }

  if (phase === 'lobby') {
    view.options = { ...room.options, themes: [...room.options.themes] };
    view.themes = THEMES.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, count: t.pairs.length }));
    view.plan = rolePlan(room.players.length, room.options);
    return view;
  }

  // Le thème n'est montré que si l'hôte l'a choisi (sinon Mr White aurait un indice gratuit).
  if (room.options.showTheme && g) {
    const t = THEMES.find((x) => x.id === g.theme);
    if (t) view.theme = { label: t.label, emoji: t.emoji };
  }

  if (me && me.role) view.me = secretFor(me, phase);

  // Le propriétaire reçoit aussi les secrets des joueurs qui jouent sur son écran (et d'eux seuls).
  const myGuests = me ? guestsOf(room, me.id) : [];
  if (myGuests.length > 0) {
    view.guests = myGuests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      me: guest.role ? secretFor(guest, phase) : null,
      myVote: phase === 'vote' ? g.votes[guest.id] || null : null,
    }));
  }

  if (phase === 'discussion' || phase === 'vote') view.order = g.order;

  if (phase === 'vote') {
    view.vote = {
      candidates: g.candidates,
      tiebreak: g.tiebreak,
      myVote: g.votes[playerId] || null,
      voted: aliveList.filter((p) => g.votes[p.id]).length,
      total: aliveList.length,
    };
  }

  if (g.result && (phase === 'result' || phase === 'whiteGuess' || phase === 'end')) view.result = g.result;
  if (phase === 'whiteGuess') view.guessFor = g.guessFor;

  if (phase === 'end') {
    view.end = {
      winner: g.winner,
      reason: g.reason,
      civilWord: g.civilWord,
      undercoverWord: g.undercoverWord,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        word: p.word,
        alive: p.alive,
        won: didWin(p.role, g.winner),
      })),
    };
  }
  return view;
}

module.exports = {
  ROLE,
  MIN_PLAYERS,
  MAX_PLAYERS,
  campOf,
  cleanText,
  wordKey,
  sameWord,
  rolePlan,
  planToRoles,
  createRoom,
  miniAct,
  addPlayer,
  addGuest,
  removeGuest,
  MAX_GUESTS_PER_PLAYER,
  removePlayer,
  kick,
  transferHost,
  setConnection,
  setOptions,
  findByToken,
  getPlayer,
  startGame,
  markReady,
  beginDiscussion,
  openVote,
  castVote,
  closeVote,
  submitGuess,
  nextRound,
  investigate,
  rematch,
  viewFor,
};
