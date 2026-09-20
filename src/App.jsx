import { useState, useEffect, useCallback } from 'react';
import { listAllObjects, presignUrl, isImage } from './r2';
import Header from './components/Header';
import GalleryGrid from './components/GalleryGrid';
import Lightbox from './components/Lightbox';
import Skeleton from './components/Skeleton';
import './App.css';

export default function App() {
  const [images, setImages]     = useState([]);
  const [status, setStatus]     = useState('loading'); // 'loading' | 'ready' | 'empty' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [lbIndex, setLbIndex]   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const allKeys   = await listAllObjects();
        const imgKeys   = allKeys.filter(isImage);

        if (imgKeys.length === 0) {
          setStatus('empty');
          return;
        }

        const urls = await Promise.all(imgKeys.map(k => presignUrl(k)));
        setImages(imgKeys.map((key, i) => ({
          key,
          url: urls[i],
          name: key.split('/').pop(),
        })));
        setStatus('ready');
      } catch (err) {
        setErrorMsg(err.message);
        setStatus('error');
      }
    }
    load();
  }, []);

  const openLightbox  = useCallback(idx => setLbIndex(idx), []);
  const closeLightbox = useCallback(() => setLbIndex(null), []);
  const navigate = useCallback(dir => {
    setLbIndex(prev => (prev + dir + images.length) % images.length);
  }, [images.length]);

  return (
    <div className="app">
      <Header count={status === 'ready' ? images.length : null} />

      {status === 'loading' && (
        <>
          <p className="status">Loading gallery…</p>
          <Skeleton />
        </>
      )}

      {status === 'error' && (
        <p className="status status--error">Error: {errorMsg}</p>
      )}

      {status === 'empty' && (
        <p className="status">No images found in the bucket.</p>
      )}

      {status === 'ready' && (
        <GalleryGrid images={images} onSelect={openLightbox} />
      )}

      {lbIndex !== null && (
        <Lightbox
          images={images}
          index={lbIndex}
          onClose={closeLightbox}
          onNavigate={navigate}
        />
      )}

      <footer className="footer">
        &copy; {new Date().getFullYear()} Gaurav Arts. All rights reserved.
      </footer>
    </div>
  );
}
