import { useState } from 'react';
import SecretCard from './SecretCard.jsx';
import SeatPicker from './SeatPicker.jsx';
import DetectivePanel from './DetectivePanel.jsx';
import { buildSeats } from '../seats.js';

export default function Discussion({ state, act }) {
  const { players, order, round, meId, hostId } = state;
  const isHost = meId === hostId;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const dead = players.filter((p) => !p.alive);

  // Seuls les joueurs encore en vie de cet écran peuvent revoir leur mot.
  const seats = buildSeats(state).filter((s) => s.me && s.me.alive);
  const [seatId, setSeatId] = useState(meId);
  const seat = seats.find((s) => s.id === seatId) ?? seats[0];
  const mine = new Set(buildSeats(state).map((s) => s.id));

  return (
    <div className="stack">
      <h1 className="display">Manche {round}</h1>
      <p className="lead">
        Chacun son tour, donne un indice sur ton mot : un mot ou une phrase courte, sans prononcer le mot lui-même. À
        voix haute, tous ensemble.
      </p>

      <section className="stack tight">
        <h2>Ordre de parole</h2>
        <ol className="order">
          {order.map((id) => (
            <li key={id} className={mine.has(id) ? 'me' : ''}>
              {byId[id]?.name}
              {id === meId && ' (toi)'}
              {byId[id]?.guest && id !== meId && mine.has(id) && ' (sur ton écran)'}
            </li>
          ))}
        </ol>
        {dead.length > 0 && <p className="muted">Éliminés : {dead.map((p) => p.name).join(', ')}</p>}
      </section>

      {seat && (
        <>
          <SeatPicker seats={seats} current={seat.id} onChange={setSeatId} done={() => false} label="Revoir le mot de :" />
          <DetectivePanel key={`d-${seat.id}`} seat={seat} players={players} act={act} />
          <SecretCard key={seat.id} me={seat.me} compact />
        </>
      )}
      {!seat && <p className="status">Tu es éliminé : tu peux encore suivre la partie.</p>}

      {isHost ? (
        <button type="button" className="btn primary" onClick={() => act('host:openVote')}>
          Ouvrir le vote
        </button>
      ) : (
        <p className="muted center">
          {players.find((p) => p.id === hostId)?.name} ouvrira le vote quand tout le monde aura parlé.
        </p>
      )}
    </div>
  );
}
