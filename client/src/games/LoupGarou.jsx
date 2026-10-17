import { useState } from 'react';
import { Seats, useSeats, Progress, HostButton, HoldReveal, nameOf, EndActions } from './shared.jsx';

const ROLES = {
  wolf: { emoji: '🐺', name: 'Loup-garou', power: 'Chaque nuit, avec les autres loups, tu choisis une victime. Le jour, fais semblant d’être innocent.' },
  villager: { emoji: '🧑‍🌾', name: 'Villageois', power: 'Tu n’as pas de pouvoir : observe, discute et vote pour démasquer les loups.' },
  seer: { emoji: '🔮', name: 'Voyante', power: 'Chaque nuit, tu découvres le vrai rôle d’un joueur de ton choix.' },
  witch: { emoji: '🧪', name: 'Sorcière', power: 'Tu as une potion de vie (sauver la victime) et une potion de mort, chacune utilisable une seule fois.' },
  hunter: { emoji: '🏹', name: 'Chasseur', power: 'Si tu meurs, tu emportes immédiatement un joueur de ton choix avec toi.' },
};
const ROLE_ORDER = ['wolf', 'seer', 'witch', 'hunter', 'villager'];
const label = (role) => `${ROLES[role].emoji} ${ROLES[role].name}`;

function Composition({ comp }) {
  return (
    <p className="muted">
      Dans la partie :{' '}
      {ROLE_ORDER.filter((r) => comp[r] > 0)
        .map((r) => `${comp[r]} ${ROLES[r].name.toLowerCase()}${comp[r] > 1 ? 's' : ''}`)
        .join(', ')}
      .
    </p>
  );
}

function Deaths({ players, events }) {
  const deaths = events.flatMap((e) => e.deaths.map((d) => ({ ...d, kind: e.kind })));
  if (deaths.length === 0) return <p className="lead">Personne n’est mort.</p>;
  return (
    <ul className="defs">
      {deaths.map((d) => (
        <li key={d.id}>
          <p>
            💀 <strong>{nameOf(players, d.id)}</strong> était {label(d.role)}
          </p>
          <p className="muted">{d.kind === 'night' ? 'Tué(e) pendant la nuit' : d.kind === 'hunter' ? 'Abattu(e) par le chasseur' : 'Éliminé(e) par le village'}</p>
        </li>
      ))}
    </ul>
  );
}

/** Une liste de joueurs en vie parmi lesquels choisir. */
function Pick({ players, ids, value, onPick, hint }) {
  return (
    <div className="vote-list" role="radiogroup">
      {ids.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={`vote-btn ${value === id ? 'on' : ''}`} onClick={() => onPick(id)}>
          {nameOf(players, id)}
          {hint?.[id] ? <small> · {hint[id]}</small> : null}
        </button>
      ))}
    </div>
  );
}

function Night({ state, seat, send }) {
  const { players } = state;
  const mine = seat.mg;
  const task = mine.task;
  const [heal, setHeal] = useState(false);
  const [poison, setPoison] = useState(null);
  const living = players.filter((p) => mine.alive[p.id]).map((p) => p.id);
  const others = living.filter((id) => id !== seat.id);

  if (task.kind === 'wolf') {
    const targets = living.filter((id) => !mine.mates.includes(id));
    const hint = {};
    for (const [mate, target] of Object.entries(task.mates)) if (target && mate !== seat.id) hint[target] = `choix de ${nameOf(players, mate)}`;
    return (
      <div className="stack">
        <h1 className="display">🐺 Choisis la victime</h1>
        <p className="lead">Mettez-vous d’accord à voix basse avec les autres loups.</p>
        <p className="muted">Loups : {mine.mates.map((id) => nameOf(players, id)).join(', ')}</p>
        <Pick players={players} ids={targets} value={task.pick} onPick={(id) => send('wolf', { targetId: id })} hint={hint} />
        {task.pick && <p className="status">Choix enregistré. Tu peux encore le changer jusqu’à ce que tous les loups aient choisi.</p>}
      </div>
    );
  }
  if (task.kind === 'seer') {
    return (
      <div className="stack">
        <h1 className="display">🔮 Qui inspectes-tu ?</h1>
        <p className="lead">Tu vas découvrir son vrai rôle.</p>
        <Pick players={players} ids={others} value={null} onPick={(id) => send('see', { targetId: id })} />
      </div>
    );
  }
  if (task.kind === 'witch') {
    const victim = task.victimId ? nameOf(players, task.victimId) : null;
    return (
      <div className="stack">
        <h1 className="display">🧪 Tes potions</h1>
        <p className="lead">{victim ? `Les loups ont choisi ${victim}.` : 'Les loups n’ont désigné personne.'}</p>
        {task.canHeal && (
          <label className="switch">
            <input type="checkbox" checked={heal} onChange={(e) => setHeal(e.target.checked)} />
            <span>
              Sauver {victim}
              <small>Potion de vie, utilisable une seule fois</small>
            </span>
          </label>
        )}
        {task.canPoison && (
          <>
            <p className="muted">Potion de mort (une seule fois) : choisis quelqu’un à empoisonner, ou personne.</p>
            <Pick players={players} ids={others} value={poison} onPick={(id) => setPoison(poison === id ? null : id)} />
          </>
        )}
        <button type="button" className="btn primary" onClick={() => send('witch', { heal: heal && task.canHeal, poisonId: task.canPoison ? poison : null })}>
          Valider ({heal || poison ? 'utiliser mes potions' : 'ne rien faire'})
        </button>
      </div>
    );
  }

  // Les joueurs qui dorment voient tous le même écran : impossible de deviner qui joue.
  const seen = mine.seerLog.find((l) => l.night === mine.night);
  return (
    <div className="stack">
      <h1 className="display">🌙 La nuit tombe…</h1>
      <p className="lead">Ferme les yeux et attends que le village se réveille. Ne regarde pas les autres écrans.</p>
      {seen && (
        <p className="notice">
          Ta vision : {nameOf(players, seen.id)} est {label(seen.role)}.
        </p>
      )}
    </div>
  );
}

export default function LoupGarou({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const mg = state.mg;
  const mine = seat.mg;
  const alive = players.filter((p) => mg.alive[p.id]);
  const iAmAlive = Boolean(mine.alive[seat.id]);
  const seatPicker = <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />;
  const role = ROLES[mine.myRole];

  if (mg.phase === 'end') {
    const wolvesWon = mg.winner === 'wolves';
    return (
      <div className="stack">
        <h1 className="display">{wolvesWon ? '🐺 Les loups gagnent !' : '🏡 Le village gagne !'}</h1>
        <p className="lead">{wolvesWon ? 'Les loups sont maintenant aussi nombreux que les villageois.' : 'Tous les loups-garous ont été démasqués.'}</p>
        <ul className="defs">
          {players.map((p) => (
            <li key={p.id} className={mg.roles[p.id] === 'wolf' ? '' : 'real'}>
              <p>
                {mg.alive[p.id] ? '' : '💀 '}
                <strong>{p.name}</strong> : {label(mg.roles[p.id])}
              </p>
            </li>
          ))}
        </ul>
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const head = (
    <>
      <p className="muted">
        {mg.night === 0 ? 'Avant la première nuit' : `Nuit ${mg.night}`} · {alive.length} joueurs en vie
      </p>
      <Composition comp={mg.comp} />
    </>
  );

  if (mg.phase === 'role') {
    return (
      <div className="stack">
        {head}
        {seatPicker}
        <h1 className="display">Ton rôle</h1>
        <HoldReveal label={`Maintiens pour voir le rôle de ${seat.name}`}>
          <span className="secret-word">{label(mine.myRole)}</span>
          <small>{role.power}</small>
          {mine.myRole === 'wolf' && mine.mates.length > 1 && (
            <small>Tes complices : {mine.mates.filter((id) => id !== seat.id).map((id) => nameOf(players, id)).join(', ')}</small>
          )}
        </HoldReveal>
        <HostButton state={state} onClick={() => sendHost('start')}>
          Tout le monde a vu son rôle : commencer la nuit
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la première nuit.</p>}
      </div>
    );
  }

  if (mg.phase === 'night') {
    return (
      <div className="stack">
        {head}
        {seatPicker}
        <Night state={state} seat={seat} send={send} />
        <HostButton state={state} ghost onClick={() => sendHost('force')}>
          Passer la nuit (si quelqu’un est absent)
        </HostButton>
      </div>
    );
  }

  if (mg.phase === 'hunter') {
    return (
      <div className="stack">
        {head}
        {seatPicker}
        <h1 className="display">🏹 Le chasseur tire !</h1>
        {mine.canShoot ? (
          <>
            <p className="lead">Tu es éliminé, mais tu peux emporter quelqu’un avec toi.</p>
            <Pick
              players={players}
              ids={alive.map((p) => p.id)}
              value={null}
              onPick={(id) => send('shoot', { targetId: id })}
            />
          </>
        ) : (
          <p className="lead">Le chasseur a été éliminé : il choisit quelqu’un à abattre. Attendez…</p>
        )}
      </div>
    );
  }

  if (mg.phase === 'dawn') {
    const recent = mine.events.filter((e) => e.night === mg.night && e.kind !== 'vote');
    return (
      <div className="stack">
        {head}
        <h1 className="display">☀️ Le village se réveille</h1>
        <Deaths players={players} events={recent} />
        <p className="lead">Discutez à voix haute : qui est un loup ?</p>
        <HostButton state={state} onClick={() => sendHost('next')}>
          Passer au vote
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte ouvre le vote quand la discussion est finie.</p>}
      </div>
    );
  }

  if (mg.phase === 'vote') {
    const ids = alive.map((p) => p.id).filter((id) => id !== seat.id);
    return (
      <div className="stack">
        {head}
        {seatPicker}
        <h1 className="display">🗳️ Le vote</h1>
        {iAmAlive ? (
          <>
            <p className="lead">Qui éliminer ? Le plus voté sort du village.</p>
            <Pick players={players} ids={ids} value={mine.myVote} onPick={(id) => send('vote', { targetId: id })} />
          </>
        ) : (
          <p className="lead">💀 Tu es éliminé : tu ne votes plus, mais tu peux regarder.</p>
        )}
        <Progress done={mine.voted.length} total={alive.length} label="ont voté" />
        <HostButton state={state} ghost onClick={() => sendHost('force')} disabled={mine.voted.length === 0}>
          Clore le vote maintenant
        </HostButton>
      </div>
    );
  }

  // verdict
  const lastVote = mine.events.map((e) => e.kind === 'vote' && e.night === mg.night).lastIndexOf(true);
  const recent = lastVote >= 0 ? mine.events.slice(lastVote) : [];
  return (
    <div className="stack">
      {head}
      <h1 className="display">{mine.verdict?.tie ? 'Égalité !' : 'Le village a décidé'}</h1>
      {mine.verdict?.tie && <p className="lead">Aucun joueur n’est éliminé.</p>}
      <Deaths players={players} events={mine.verdict?.tie ? [] : recent} />
      <HostButton state={state} onClick={() => sendHost('next')}>
        La nuit tombe
      </HostButton>
      {state.meId !== state.hostId && <p className="muted center">L’hôte lance la nuit suivante.</p>}
    </div>
  );
}
