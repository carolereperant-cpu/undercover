import { useState } from 'react';
import { loadName } from '../session.js';

// Un lien du type https://…/?salle=ABCD pré-remplit le code : pratique à partager dans un groupe.
function codeFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('salle');
  return raw ? raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : '';
}

export default function Home({ create, join }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(codeFromUrl);
  const [joining, setJoining] = useState(Boolean(codeFromUrl()));
  const [busy, setBusy] = useState(false);

  const cleanName = name.trim();

  const submitCreate = async () => {
    setBusy(true);
    await create(cleanName);
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
      <h1 className="display">Un mot pour tous, sauf pour un.</h1>
      <p className="lead">
        Chacun reçoit un mot secret sur son téléphone. Certains ont un mot presque identique, sans le savoir. À vous de
        les démasquer.
      </p>

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

      {joining && (
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
      )}

      {joining ? (
        <>
          <button className="btn primary" disabled={busy || !cleanName || code.length !== 4}>
            Rejoindre la salle
          </button>
          <button type="button" className="btn ghost" onClick={() => setJoining(false)}>
            Plutôt créer une salle
          </button>
        </>
      ) : (
        <>
          <button className="btn primary" disabled={busy || !cleanName}>
            Créer une salle
          </button>
          <button type="button" className="btn ghost" onClick={() => setJoining(true)}>
            J’ai un code
          </button>
        </>
      )}
    </form>
  );
}
