import { useEffect } from 'react';

export default function Lightbox({ images, index, onClose, onNavigate }) {
  const img = images[index];

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onNavigate]);

  if (!img) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button className="lb-close" onClick={onClose} aria-label="Close">&#x2715;</button>

      <button className="lb-nav lb-prev" onClick={() => onNavigate(-1)} aria-label="Previous">
        &#x2039;
      </button>

      <img src={img.url} alt={img.name} className="lb-image" />

      <button className="lb-nav lb-next" onClick={() => onNavigate(1)} aria-label="Next">
        &#x203a;
      </button>

      <p className="lb-caption">{img.name}</p>
    </div>
  );
}
