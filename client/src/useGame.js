import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket.js';
import { clearSession, loadSession, saveName, saveSession } from './session.js';

/**
 * Tout le lien avec le serveur est ici : l'état du jeu, la connexion, et les actions.
 * Les composants n'appellent jamais socket directement, ils utilisent `act`.
 */
export function useGame() {
  const [state, setState] = useState(null); // la vue de la partie envoyée par le serveur
  const [connected, setConnected] = useState(socket.connected);
  const [booting, setBooting] = useState(Boolean(loadSession()));
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /** Envoie un événement et attend la réponse du serveur (avec un délai maximum). */
  const act = useCallback(
    (event, payload = {}) =>
      new Promise((resolve) => {
        // `quiet` : l'erreur éventuelle n'est pas affichée (ex. fin du temps envoyée par tous les joueurs à la fois).
        const { quiet, ...data } = payload;
        socket.timeout(8000).emit(event, data, (err, res) => {
          if (err) {
            if (!quiet) notify('Le serveur ne répond pas. Vérifie ta connexion.');
            resolve({ ok: false });
            return;
          }
          if (res && !res.ok && res.error && !quiet) notify(res.error);
          resolve(res || { ok: true });
        });
      }),
    [notify],
  );

  useEffect(() => {
    const rejoin = () => {
      const session = loadSession();
      if (!session) {
        setBooting(false);
        return;
      }
      socket.timeout(8000).emit('room:rejoin', session, (err, res) => {
        if (!err && res && !res.ok) {
          // La salle n'existe plus ou on a été retiré : on repart de zéro.
          clearSession();
          setState(null);
          if (res.error) notify(res.error);
        }
        setBooting(false);
      });
    };

    const onConnect = () => {
      setConnected(true);
      rejoin();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (view) => setState(view);
    const onKicked = ({ reason } = {}) => {
      clearSession();
      setState(null);
      notify(reason || 'Tu as quitté la salle.');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('kicked', onKicked);
    socket.connect();

    // Au retour sur l'onglet (téléphone déverrouillé), on s'assure d'être bien connecté.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('kicked', onKicked);
      socket.disconnect();
    };
  }, [notify]);

  const create = useCallback(
    async (name, gameType = 'undercover') => {
      saveName(name);
      const res = await act('room:create', { name, gameType });
      if (res.ok) saveSession({ code: res.code, token: res.token });
      return res;
    },
    [act],
  );

  const join = useCallback(
    async (code, name) => {
      saveName(name);
      const res = await act('room:join', { code, name });
      if (res.ok) saveSession({ code: res.code, token: res.token });
      return res;
    },
    [act],
  );

  const leave = useCallback(async () => {
    await act('room:leave');
    clearSession();
    setState(null);
  }, [act]);

  return { state, connected, booting, toast, notify, act, create, join, leave };
}
