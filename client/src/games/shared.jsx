import { useEffect, useState } from 'react';
import SeatPicker from '../components/SeatPicker.jsx';
import { buildMgSeats, withSeat } from '../seats.js';

/**
 * Tout ce que les écrans de jeu ont en commun :
 * - quel joueur de cet écran agit (moi ou un invité),
 * - envoyer une action au serveur au nom de ce joueur.
 */
export function useSeats(state, act) {
  const seats = buildMgSeats(state);
  const [seatId, setSeatId] = useState(state.meId);
  const seat = seats.find((s) => s.id === seatId) ?? seats[0];
  const send = (type, payload = {}) => act('game:act', withSeat(seat, { type, ...payload }));
  // Action réservée à l'hôte : jamais envoyée au nom d'un invité.
  const sendHost = (type, payload = {}) => act('game:act', { type, ...payload });
  return { seats, seat, setSeatId, send, sendHost, shared: seats.length > 1 };
}

export const nameOf = (players, id) => players.find((p) => p.id === id)?.name ?? '?';

export function Seats({ seats, seat, onChange, done, label = 'Qui joue sur cet écran ?' }) {
  return <SeatPicker seats={seats} current={seat.id} onChange={onChange} done={done} label={label} />;
}

/** Contenu secret : visible seulement tant que le doigt reste appuyé (comme la carte d'Undercover). */
export function HoldReveal({ label = 'Maintiens pour voir', children }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const hide = () => setShown(false);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);
  const onKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setShown(true);
    }
  };
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') setShown(false);
  };
  return (
    <button
      type="button"
      className={`hold ${shown ? 'open' : ''}`}
      onPointerDown={() => setShown(true)}
      onPointerUp={() => setShown(false)}
      onPointerLeave={() => setShown(false)}
      onPointerCancel={() => setShown(false)}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {shown ? children : <span className="hold-hint">{label}</span>}
    </button>
  );
}

/** Fin de partie : classement éventuel, rejouer (hôte) et quitter. */
export function EndActions({ state, act, leave }) {
  const isHost = state.meId === state.hostId;
  const host = state.players.find((p) => p.id === state.hostId);
  return (
    <>
      {isHost ? (
        <button type="button" className="btn primary" onClick={() => act('host:rematch')}>
          Rejouer avec les mêmes joueurs
        </button>
      ) : (
        <p className="muted center">{host?.name} peut relancer une partie.</p>
      )}
      <button type="button" className="btn ghost" onClick={leave}>
        Quitter la salle
      </button>
    </>
  );
}

export function Progress({ done, total, label = 'ont répondu' }) {
  return (
    <p className="muted center">
      {done} sur {total} {label}
    </p>
  );
}

export function HostButton({ state, onClick, children, ghost = false, disabled = false }) {
  if (state.meId !== state.hostId) return null;
  return (
    <button type="button" className={`btn ${ghost ? 'ghost' : 'primary'}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export const MEDALS = ['🥇', '🥈', '🥉'];

export function Ranking({ players, rows, unit }) {
  return (
    <ol className="ranking">
      {rows.map((row, i) => (
        <li key={row.id}>
          <span>{MEDALS[i] ?? `${i + 1}.`}</span>
          <span className="name">{nameOf(players, row.id)}</span>
          <strong>
            {row.value} {unit}
          </strong>
        </li>
      ))}
    </ol>
  );
}
