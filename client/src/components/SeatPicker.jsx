/**
 * Sélecteur "qui regarde l'écran ?" : n'apparaît que s'il y a des invités sur cet écran.
 * `done(seat)` indique si le joueur a terminé son action (mot mémorisé, vote enregistré…).
 */
export default function SeatPicker({ seats, current, onChange, done, label }) {
  if (seats.length < 2) return null;
  return (
    <div className="seat-picker" role="group" aria-label={label}>
      <p className="muted">{label}</p>
      <div className="chips">
        {seats.map((seat) => (
          <button
            key={seat.id}
            type="button"
            className={`chip ${current === seat.id ? 'on' : ''}`}
            aria-pressed={current === seat.id}
            onClick={() => onChange(seat.id)}
          >
            {done(seat) ? '✓ ' : ''}
            {seat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
