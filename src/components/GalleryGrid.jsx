import { useState } from 'react';

export default function GalleryGrid({ images, onSelect }) {
  return (
    <div className="gallery">
      {images.map((img, idx) => (
        <Thumb key={img.key} img={img} onClick={() => onSelect(idx)} />
      ))}
    </div>
  );
}

function Thumb({ img, onClick }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="thumb" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Open ${img.name}`}
    >
      {!loaded && <div className="thumb-skeleton" style={{ position: 'absolute', inset: 0, margin: 0 }} />}
      <img
        src={img.url}
        alt={img.name}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={e => { e.currentTarget.closest('.thumb').style.display = 'none'; }}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
