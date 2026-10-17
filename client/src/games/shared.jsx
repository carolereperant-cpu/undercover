import { useEffect, useRef, useState } from 'react';
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

/**
 * Compte à rebours basé sur l'horloge du serveur (pour ne pas dépendre de l'heure du téléphone).
 * `onZero` est appelé une seule fois par échéance, quand le temps est écoulé.
 */
export function useCountdown(deadline, serverNow, onZero) {
  const [left, setLeft] = useState(() => (deadline ? Math.max(0, Math.ceil((deadline - serverNow) / 1000)) : 0));
  const callback = useRef(onZero);
  callback.current = onZero;
  const firedFor = useRef(null);
  useEffect(() => {
    if (!deadline) return undefined;
    const offset = serverNow - Date.now(); // écart entre l'horloge du serveur et celle de ce téléphone
    const tick = () => {
      const ms = deadline - (Date.now() + offset);
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && firedFor.current !== deadline) {
        firedFor.current = deadline;
        callback.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, serverNow]);
  return left;
}

export function Timer({ left, total }) {
  const pct = total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  return (
    <div className={`timer ${left <= 5 ? 'low' : ''}`} role="timer" aria-label={`${left} secondes restantes`}>
      <span className="timer-bar" style={{ width: `${pct}%` }} />
      <strong>{left} s</strong>
    </div>
  );
}
