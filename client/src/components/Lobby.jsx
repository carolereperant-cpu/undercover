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
  const { code, players, meId, hostId, options, plan, limits } = state;
  const isHost = meId === hostId;
  const count = players.length;
  const missing = limits.min - count;
  const host = players.find((p) => p.id === hostId);
  const myGuests = players.filter((p) => p.ownerId === meId);

  const [guestName, setGuestName] = useState('');
  const [bigQr, setBigQr] = useState(false);

  const link = `${window.location.origin}/?salle=${code}`;

  const share = async () => {
    const data = { title: 'Undercover', text: `Rejoins ma partie d’Undercover (salle ${code})`, url: link };
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

  const ownerName = (id) => players.find((p) => p.id === id)?.name ?? '';

  return (
    <div className="stack">
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
      </section>

      {myGuests.length < MAX_GUESTS && count < limits.max && (
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

      <section className="stack tight">
        <h2>Rôles pour {count} joueurs</h2>
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

      {isHost && (
        <section className="stack tight">
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
            Lancer la partie
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
