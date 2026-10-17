import { useState } from 'react';
import SecretCard from './SecretCard.jsx';
import SeatPicker from './SeatPicker.jsx';
import { buildSeats, withSeat } from '../seats.js';

export default function Reveal({ state, act }) {
  const { players, meId, hostId } = state;
  const isHost = meId === hostId;
  const seats = buildSeats(state);
  const [seatId, setSeatId] = useState(meId);
  const seat = seats.find((s) => s.id === seatId) ?? seats[0];

  const readyCount = players.filter((p) => p.ready).length;
  const waiting = players.filter((p) => !p.ready);
  const shared = seats.length > 1;

  const markReady = async () => {
    const res = await act('player:ready', withSeat(seat));
    if (res.ok) {
      // On passe automatiquement au prochain joueur de l'écran qui n'a pas encore vu son mot.
      const next = seats.find((s) => s.id !== seat.id && !s.ready);
      if (next) setSeatId(next.id);
    }
  };

  return (
    <div className="stack">
      <h1 className="display">{shared ? `Au tour de ${seat.name}.` : 'Découvre ton mot, en secret.'}</h1>
      <p className="lead">
        {shared
          ? `Passe l’écran à ${seat.name}, qui maintient la carte appuyée pour voir son mot. Les autres ne regardent pas.`
          : 'Cache ton écran aux autres, puis maintiens la carte appuyée. Retiens bien ton mot : tu pourras le revoir pendant la partie.'}
      </p>

      <SeatPicker seats={seats} current={seat.id} onChange={setSeatId} done={(s) => s.ready} label="Qui regarde l’écran ?" />

      {seat.me && <SecretCard key={seat.id} me={seat.me} />}

      {seat.ready ? (
        <p className="status">
          Mot mémorisé.{' '}
          {waiting.length > 0 ? `En attente de ${waiting.map((p) => p.name).join(', ')}…` : 'Tout le monde est prêt.'}
        </p>
      ) : (
        <button type="button" className="btn primary" onClick={markReady}>
          {shared ? `${seat.name} a mémorisé son mot` : 'J’ai mémorisé mon mot'}
        </button>
      )}

      <p className="muted center">
        {readyCount} joueur{readyCount > 1 ? 's' : ''} sur {players.length} prêt{readyCount > 1 ? 's' : ''}
      </p>

      {isHost && readyCount < players.length && (
        <button type="button" className="btn ghost" onClick={() => act('host:begin')}>
          Commencer sans attendre
        </button>
      )}
    </div>
  );
}
