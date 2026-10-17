import { io } from 'socket.io-client';

// Pas d'URL : le navigateur se connecte au serveur qui lui a servi la page.
// En développement, le proxy de Vite (vite.config.js) fait le lien avec le serveur Node.
export const socket = io({
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnectionDelayMax: 3000,
});
