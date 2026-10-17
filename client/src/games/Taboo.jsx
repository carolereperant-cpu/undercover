import { Seats, useSeats, HostButton, nameOf, EndActions, useCountdown, Timer } from './shared.jsx';

const TEAM = { A: { name: 'Équipe Soleil', emoji: '☀️' }, B: { name: 'Équipe Lune', emoji: '🌙' } };
const label = (t) => `${TEAM[t].emoji} ${TEAM[t].name}`;
const OUTCOME = { found: '✅ Trouvé', pass: '⏭️ Passé', taboo: '🚫 Interdit' };

function Scores({ mg }) {
  return (
    <p className="scorebar">
      <span>{label('A')} : <strong>{mg.scores.A}</strong></span>
      <span>{label('B')} : <strong>{mg.scores.B}</strong></span>
    </p>
  );
}

function Teams({ players, mg }) {
  return (
    <div className="stack tight">
      {['A', 'B'].map((t) => (
        <p key={t} className="muted">
          {label(t)} : {mg.teams[t].map((id) => nameOf(players, id)).join(', ')}
        </p>
      ))}
    </div>
  );
}

export default function Taboo({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const mg = state.mg;
  const mine = seat.mg;
  const left = useCountdown(mg.deadline, mg.serverNow, () => act('game:act', { type: 'timeup', quiet: true }));
  const describer = nameOf(players, mg.describerId);

  if (mg.phase === 'end') {
    const { A, B } = mg.scores;
    return (
      <div className="stack">
        <h1 className="display">{A === B ? 'Égalité !' : `${label(A > B ? 'A' : 'B')} gagne !`}</h1>
        <Scores mg={mg} />
        <Teams players={players} mg={mg} />
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const head = (
    <>
      <p className="muted">
        Tour {mg.turn} sur {mg.totalTurns}
      </p>
      <Scores mg={mg} />
    </>
  );

  if (mg.phase === 'result') {
    return (
      <div className="stack">
        {head}
        <h1 className="display">Temps écoulé !</h1>
        {mg.log.length === 0 ? (
          <p className="lead">Aucune carte jouée ce tour.</p>
        ) : (
          <ul className="defs">
            {mg.log.map((l, i) => (
              <li key={i} className={l.outcome === 'found' ? 'real' : ''}>
                <p>
                  {OUTCOME[l.outcome]} : <strong>{l.word}</strong>
                </p>
              </li>
            ))}
          </ul>
        )}
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.turn >= mg.totalTurns ? 'Voir le résultat final' : 'Tour suivant'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
      </div>
    );
  }

  if (mg.phase === 'ready') {
    return (
      <div className="stack">
        {head}
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
        <h1 className="display">{label(mg.team)}</h1>
        <p className="lead">
          {describer} fait deviner des mots à son équipe pendant {mg.seconds} secondes.
          {mine.isDescriber ? ' C’est toi !' : mine.myTeam === mg.team ? ' Tu es dans son équipe : ne regarde pas son écran.' : ' Tu es dans l’équipe adverse : tu surveilles les mots interdits.'}
        </p>
        {mine.isDescriber ? (
          <button type="button" className="btn primary" onClick={() => send('start')}>
            Je suis prêt, c’est parti !
          </button>
        ) : (
          <HostButton state={state} ghost onClick={() => sendHost('start')}>
            Lancer le tour à sa place
          </HostButton>
        )}
        <Teams players={players} mg={mg} />
      </div>
    );
  }

  // Tour en cours
  return (
    <div className="stack">
      {head}
      <Timer left={left} total={mg.seconds} />
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
      <p className="muted center">
        {label(mg.team)} · {describer} décrit · {mg.foundCount} trouvé{mg.foundCount > 1 ? 's' : ''}
      </p>
      {mine.card ? (
        <div className="taboo-card">
          <p className="taboo-word">{mine.card.word}</p>
          <p className="muted">Mots interdits :</p>
          <ul className="chips">
            {mine.card.forbidden.map((w) => (
              <li key={w} className="chip static">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="lead">Écoute {describer} et devine le mot ! (Ta carte est cachée.)</p>
      )}
      {mine.isDescriber && (
        <div className="answers">
          <button type="button" className="btn primary" onClick={() => send('found')}>
            ✅ Trouvé
          </button>
          <button type="button" className="btn ghost" onClick={() => send('pass')}>
            ⏭️ Passer
          </button>
        </div>
      )}
      {!mine.isDescriber && mine.myTeam !== mg.team && (
        <button type="button" className="btn danger" onClick={() => send('taboo')}>
          🚫 Interdit !
        </button>
      )}
      <HostButton state={state} ghost onClick={() => sendHost('force')}>
        Terminer le tour maintenant
      </HostButton>
    </div>
  );
}
