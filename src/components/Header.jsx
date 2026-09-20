export default function Header({ count }) {
  return (
    <header className="header">
      <h1 className="header__title">Gaurav Arts</h1>
      <p className="header__sub">Photography &amp; Fine Art</p>
      {count !== null && (
        <p className="header__count">
          {count > 0 ? `${count} photo${count !== 1 ? 's' : ''}` : ''}
        </p>
      )}
    </header>
  );
}
