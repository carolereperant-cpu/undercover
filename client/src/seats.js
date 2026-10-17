/**
 * Un "siège" = un joueur qui joue sur CET écran : soi-même, plus les invités
 * (un enfant sans smartphone, par exemple) que l'on a ajoutés dans la salle.
 *
 * Le serveur n'envoie les secrets des invités qu'à leur propriétaire (state.guests).
 * Pour agir au nom d'un invité, on ajoute asId à l'événement ; le serveur vérifie que l'invité nous appartient.
 */
export function buildSeats(state) {
  const mePlayer = state.players.find((p) => p.id === state.meId);
  const seats = [
    {
      id: state.meId,
      asId: undefined,
      name: mePlayer ? mePlayer.name : 'Moi',
      isGuest: false,
      me: state.me ?? null,
      myVote: state.vote ? state.vote.myVote : null,
      ready: Boolean(mePlayer && mePlayer.ready),
    },
  ];
  for (const guest of state.guests ?? []) {
    const player = state.players.find((p) => p.id === guest.id);
    seats.push({
      id: guest.id,
      asId: guest.id,
      name: guest.name,
      isGuest: true,
      me: guest.me,
      myVote: guest.myVote,
      ready: Boolean(player && player.ready),
    });
  }
  return seats;
}

/** Ajoute asId au contenu d'un événement quand le siège est un invité. */
export const withSeat = (seat, payload = {}) => (seat.asId ? { ...payload, asId: seat.asId } : payload);

/**
 * Sièges pour les mini-jeux : soi-même et les invités de cet écran.
 * Le serveur envoie la vue de chaque siège : state.mg pour soi, state.mgGuests[id] pour les invités.
 */
export function buildMgSeats(state) {
  const mePlayer = state.players.find((p) => p.id === state.meId);
  const seats = [{ id: state.meId, asId: undefined, name: mePlayer ? mePlayer.name : 'Moi', isGuest: false, mg: state.mg }];
  for (const p of state.players) {
    if (p.ownerId === state.meId && state.mgGuests?.[p.id]) {
      seats.push({ id: p.id, asId: p.id, name: p.name, isGuest: true, mg: state.mgGuests[p.id] });
    }
  }
  return seats;
}
