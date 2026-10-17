import { useEffect, useState } from 'react';
import { loadName } from '../session.js';

// Un lien du type https://…/?salle=ABCD pré-remplit le code : pratique à partager dans un groupe.
function codeFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('salle');
  return raw ? raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : '';
}

// Si la liste des jeux ne charge pas, on garde au moins Undercover.
const FALLBACK = [
  { id: 'undercover', label: 'Undercover', emoji: '🎭', tagline: 'Un mot pour tous, sauf pour un.', min: 3, max: 12, minutes: '10 à 20', maxMinutes: 20 },
];

const PLAYER_FILTERS = [
  { key: 'all', label: 'Peu importe', fits: () => true },
  { key: '2', label: '2', fits: (g) => g.min <= 2 && g.max >= 2 },
  { key: '3', label: '3', fits: (g) => g.min <= 3 && g.max >= 3 },
  { key: '4', label: '4', fits: (g) => g.min <= 4 && g.max >= 4 },
  { key: '5', label: '5-6', fits: (g) => g.min <= 6 && g.max >= 5 },
  { key: '7', label: '7-9', fits: (g) => g.min <= 9 && g.max >= 7 },
  { key: '10', label: '10-13', fits: (g) => g.min <= 13 && g.max >= 10 },
];

const TIME_FILTERS = [
  { key: 'all', label: 'Toutes durées', fits: () => true },
  { key: '10', label: '10 min max', fits: (g) => g.maxMinutes <= 10 },
  { key: '20', label: '20 min max', fits: (g) => g.maxMinutes <= 20 },
];

export default function Home({ create, join }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(codeFromUrl);
  const [joining, setJoining] = useState(Boolean(codeFromUrl()));
  const [busy, setBusy] = useState(false);
  const [games, setGames] = useState(FALLBACK);
  const [gameId, setGameId] = useState('undercover');
  const [players, setPlayers] = useState('all');
  const [time, setTime] = useState('all');

  useEffect(() => {
    let alive = true;
    fetch('/api/games')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('liste indisponible'))))
      .then((list) => alive && Array.isArray(list) && list.length > 0 && setGames(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const cleanName = name.trim();
  const playerFilter = PLAYER_FILTERS.find((f) => f.key === players);
  const timeFilter = TIME_FILTERS.find((f) => f.key === time);
  const visible = games.filter((g) => playerFilter.fits(g) && timeFilter.fits(g));
  const chosen = visible.find((g) => g.id === gameId) ?? visible[0] ?? null;

  const submitCreate = async () => {
    if (!chosen) return;
    setBusy(true);
    await create(cleanName, chosen.id);
    setBusy(false);
  };

  const submitJoin = async () => {
    setBusy(true);
    const res = await join(code, cleanName);
    setBusy(false);
    if (res.ok) window.history.replaceState(null, '', window.location.pathname);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (busy || !cleanName) return;
    if (joining) {
      if (code.length === 4) submitJoin();
    } else submitCreate();
  };

  return (
    <form className="stack home" onSubmit={onSubmit}>
      <h1 className="display">{joining ? 'Rejoins la partie.' : 'Des jeux à plusieurs, sur vos téléphones.'}</h1>
      {!joining && (
        <p className="lead">Choisis un jeu, crée une salle et partage le code ou le QR code. Gratuit, sans compte.</p>
      )}

      <label className="field">
        <span>Ton pseudo</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          autoComplete="nickname"
          autoCapitalize="words"
          placeholder="Camille"
        />
      </label>

      {joining ? (
        <>
          <label className="field">
            <span>Code de la salle</span>
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABCD"
              maxLength={4}
            />
          </label>
          <button className="btn primary" disabled={busy || !cleanName || code.length !== 4}>
            Rejoindre la salle
          </button>
          <button type="button" className="btn ghost" onClick={() => setJoining(false)}>
            Plutôt créer une salle
          </button>
        </>
      ) : (
        <>
          <fieldset className="filters">
            <legend>Combien êtes-vous ?</legend>
            <div className="chips">
              {PLAYER_FILTERS.map((f) => (
                <button key={f.key} type="button" className={`chip ${players === f.key ? 'on' : ''}`} aria-pressed={players === f.key} onClick={() => setPlayers(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="filters">
            <legend>Combien de temps ?</legend>
            <div className="chips">
              {TIME_FILTERS.map((f) => (
                <button key={f.key} type="button" className={`chip ${time === f.key ? 'on' : ''}`} aria-pressed={time === f.key} onClick={() => setTime(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="game-list" role="radiogroup" aria-label="Choisis un jeu">
            {visible.length === 0 && <p className="notice">Aucun jeu ne correspond. Essaie un autre nombre de joueurs ou de minutes.</p>}
            {visible.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={chosen?.id === g.id}
                className={`game-card ${chosen?.id === g.id ? 'on' : ''}`}
                onClick={() => setGameId(g.id)}
              >
                <span className="game-emoji" aria-hidden="true">
                  {g.emoji}
                </span>
                <span className="game-text">
                  <strong>{g.label}</strong>
                  <span>{g.tagline}</span>
                  <small>
                    {g.min === g.max ? `${g.min} joueurs` : `${g.min} à ${g.max} joueurs`} · {g.minutes} min
                  </small>
                </span>
              </button>
            ))}
          </div>

          <button className="btn primary" disabled={busy || !cleanName || !chosen}>
            {chosen ? `Créer une salle · ${chosen.label}` : 'Créer une salle'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setJoining(true)}>
            J’ai un code
          </button>
        </>
      )}
    </form>
  );
}
