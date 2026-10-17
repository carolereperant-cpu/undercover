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
