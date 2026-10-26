import { useState } from 'react';
import { ROLE_INFO } from '../roles.js';
import QrCode from './QrCode.jsx';

const OPTION_LABELS = [
  { key: 'mrwhite', label: 'Mr White', hint: 'À partir de 5 joueurs' },
  { key: 'shield', label: 'Le Bouclier', hint: 'À partir de 6 joueurs' },
  { key: 'detective', label: 'Le Détective', hint: 'À partir de 7 joueurs' },
];

const PLAN_ORDER = ['civil', 'undercover', 'mrwhite', 'bouclier', 'detective'];
const MAX_GUESTS = 3;

export default function Lobby({ state, act, notify }) {
  const { code, players, meId, hostId, options, plan, limits, themes, game: miniGame } = state;
  const isMini = Boolean(miniGame); // un mini-jeu (pas Undercover)
  const isHost = meId === hostId;
  const count = players.length;
  const missing = limits.min - count;
  const host = players.find((p) => p.id === hostId);
  const myGuests = players.filter((p) => p.ownerId === meId);

  const [guestName, setGuestName] = useState('');
  const [bigQr, setBigQr] = useState(false);

  const link = `${window.location.origin}/?salle=${code}`;

  const share = async () => {
    const gameName = miniGame ? miniGame.label : 'Undercover';
    const data = { title: gameName, text: `Rejoins ma partie de ${gameName} (salle ${code})`, url: link };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(link);
      notify('Lien copié. Envoie-le au groupe.');
    } catch {
      /* partage annulé par le joueur */
    }
  };

  const addGuest = async (e) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    const res = await act('guest:add', { name });
    if (res.ok) setGuestName('');
  };

  // Les thèmes servent à Undercover et aux mini-jeux qui le demandent (le quiz).
  const usesThemes = !isMini || Boolean(miniGame.themes);
  const allThemes = usesThemes ? themes.map((t) => t.id) : [];
  const selected = new Set(usesThemes ? options.themes : []);
  const allSelected = usesThemes && selected.size === themes.length;
  const toggleTheme = (id) => {
    const next = selected.has(id) ? allThemes.filter((t) => t !== id && selected.has(t)) : allThemes.filter((t) => t === id || selected.has(t));
    if (next.length === 0) {
      notify('Garde au moins un thème.');
      return;
    }
    act('host:options', { themes: next });
  };
  const pairCount = usesThemes ? themes.filter((t) => selected.has(t.id)).reduce((sum, t) => sum + t.count, 0) : 0;

  const ownerName = (id) => players.find((p) => p.id === id)?.name ?? '';

  return (
    <div className="stack">
      {isMini && (
        <section className="stack tight">
          <h1 className="display">
            {miniGame.emoji} {miniGame.label}
          </h1>
          <p className="lead">{miniGame.tagline}</p>
          <ol className="rules-short">
            {miniGame.rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      )}
      <section className="code-block">
        <p className="muted">Les autres joueurs entrent ce code, ou scannent le QR code</p>
        <p className="big-code" aria-label={`Code de la salle : ${code.split('').join(' ')}`}>
          {code}
        </p>
        <div className="qr-wrap">
          <QrCode value={link} size={176} label={`QR code pour rejoindre la salle ${code}`} />
          <button type="button" className="btn secondary" onClick={() => setBigQr(true)}>
            Agrandir le QR code
          </button>
        </div>
        <button type="button" className="btn secondary" onClick={share}>
          Partager le lien
        </button>
      </section>

      <section className="stack tight">
        <h2>
          Joueurs ({count}/{limits.max})
        </h2>
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              <span className="name">
                {p.name}
                {p.id === meId && ' (toi)'}
              </span>
              {p.isHost && <span className="tag">Hôte</span>}
              {p.bot && <span className="tag soft">🤖 Bot</span>}
              {p.guest && (
                <span className="tag soft">{p.ownerId === meId ? 'Sur ton écran' : `Sur l’écran de ${ownerName(p.ownerId)}`}</span>
              )}
              {!p.guest && !p.connected && <span className="tag soft">Hors ligne</span>}
              {p.guest && p.ownerId === meId ? (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => act('guest:remove', { guestId: p.id })}
                  aria-label={`Retirer ${p.name}`}
                >
                  Retirer
                </button>
              ) : (
                isHost &&
                p.id !== meId && (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => act('host:kick', { targetId: p.id })}
                    aria-label={`Retirer ${p.name}`}
                  >
                    Retirer
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
        {isHost && state.canBot && count < limits.max && players.filter((p) => p.bot).length < (miniGame.maxBots || 1) && (
          <button type="button" className="btn secondary" onClick={() => act('bot:add', {})}>
            {(miniGame.maxBots || 1) > 1 ? '🤖 Ajouter un bot' : '🤖 Jouer contre un bot'}
          </button>
        )}
      </section>

      {!state.noGuests && myGuests.length < MAX_GUESTS && count < limits.max && (
        <form className="panel" onSubmit={addGuest}>
          <h2>Quelqu’un joue sur ton écran ?</h2>
          <p className="muted">
            Pour un enfant sans smartphone, par exemple : ajoute son prénom, il jouera avec ton téléphone. Tu pourras le
            faire passer d’un joueur à l’autre pendant la partie.
          </p>
          <label className="field">
            <span>Prénom du joueur</span>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={16}
              autoComplete="off"
              placeholder="Léo"
            />
          </label>
          <button className="btn secondary" disabled={!guestName.trim()}>
            Ajouter ce joueur
          </button>
        </form>
      )}

      {!isMini && (
      <section className="stack tight">
        <h2>Rôles pour {count} joueur{count > 1 ? 's' : ''}</h2>
        <ul className="plan">
          {PLAN_ORDER.filter((r) => plan[r] > 0).map((r) => (
            <li key={r}>
              <span>
                {ROLE_INFO[r].emoji} {ROLE_INFO[r].name}
              </span>
              <strong>{plan[r]}</strong>
            </li>
          ))}
        </ul>
      </section>
      )}

      {usesThemes && (
      <section className="stack tight">
        <h2>{isMini ? 'Thèmes des questions' : 'Thèmes des mots'}</h2>
        {isHost ? (
          <>
            <ul className="chips">
              {themes.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`chip ${selected.has(t.id) ? 'on' : ''}`}
                    aria-pressed={selected.has(t.id)}
                    onClick={() => toggleTheme(t.id)}
                  >
                    {t.emoji} {t.label}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn secondary"
              disabled={allSelected}
              onClick={() => act('host:options', { themes: allThemes })}
            >
              Tout mélanger
            </button>
            <p className="muted">
              {isMini ? `${pairCount} questions possibles avec ta sélection.` : `${pairCount} paires de mots possibles avec ta sélection.`}
            </p>
            {!isMini && (
            <label className="switch">
              <input
                type="checkbox"
                checked={options.showTheme}
                onChange={(e) => act('host:options', { showTheme: e.target.checked })}
              />
              <span>
                Afficher le thème pendant la partie
                <small>Plus facile pour Mr White, qui connaît alors la catégorie</small>
              </span>
            </label>
            )}
          </>
        ) : (
          <p className="muted">
            {allSelected
              ? 'Tous les thèmes sont mélangés.'
              : themes.filter((t) => selected.has(t.id)).map((t) => `${t.emoji} ${t.label}`).join(' · ')}
          </p>
        )}
      </section>
      )}

      {!isMini && isHost && (
        <section className="stack tight">
          <h2>Mode de jeu</h2>
          <label className="switch">
            <input type="checkbox" checked={options.paper} onChange={(e) => act('host:options', { paper: e.target.checked })} />
            <span>
              Mode dessin (papier et crayon)
              <small>Au lieu de donner un indice à voix haute, chacun dessine son mot sur une feuille, les uns derrière les autres</small>
            </span>
          </label>
          <h2>Rôles spéciaux</h2>
          {OPTION_LABELS.map(({ key, label, hint }) => (
            <label key={key} className="switch">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(e) => act('host:options', { [key]: e.target.checked })}
              />
              <span>
                {label}
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </section>
      )}

      {isHost ? (
        <>
          <button type="button" className="btn primary" disabled={missing > 0} onClick={() => act('host:start')}>
            {isMini ? 'Lancer le jeu' : 'Lancer la partie'}
          </button>
          {missing > 0 && (
            <p className="muted center">
              Il manque {missing} joueur{missing > 1 ? 's' : ''} pour commencer.
            </p>
          )}
        </>
      ) : (
        <p className="muted center">{host ? `${host.name} lancera la partie.` : 'En attente de l’hôte…'}</p>
      )}

      {bigQr && (
        <div className="overlay center-overlay" role="dialog" aria-modal="true" aria-label="QR code de la salle" onClick={() => setBigQr(false)}>
          <div className="sheet qr-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Salle {code}</h2>
            <QrCode value={link} size={280} label={`QR code pour rejoindre la salle ${code}`} />
            <p className="muted">Scanne avec l’appareil photo du téléphone.</p>
            <button type="button" className="btn primary" onClick={() => setBigQr(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
