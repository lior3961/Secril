import Button from './Button';

export default function Hero({ onStartShopping, onScrollAbout }) {
  return (
    <section className="hero">
      <div className="container">
        <h1>ברוכים הבאים ל-Secril</h1>
        <p>אתר מסחר נקי ומהיר. מוצרים איכותיים, חוויית משתמש מעולה, ותשלום מאובטח.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button className="primary" onClick={onStartShopping}>התחילו לקנות</Button>
          <Button className="ghost" onClick={onScrollAbout}>קצת עלינו</Button>
        </div>
      </div>
    </section>
  );
}
