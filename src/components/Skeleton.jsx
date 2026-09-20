export default function Skeleton() {
  return (
    <div className="gallery">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="thumb-skeleton" />
      ))}
    </div>
  );
}
