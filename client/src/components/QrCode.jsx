import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Affiche un QR code pour `value` (ici le lien de la salle). Généré dans le navigateur : rien n'est envoyé à un tiers. */
export default function QrCode({ value, size = 200, label }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size * 2, // deux fois plus de pixels que la taille affichée : net sur écran haute densité
      color: { dark: '#1b1433', light: '#fbf8ff' },
    })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return null;
  return <img className="qr" src={src} width={size} height={size} alt={label} />;
}
