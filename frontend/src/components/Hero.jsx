import Button from './Button';

export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <h1>ברוכים הבאים ל-Secril</h1>
        <div style={{ marginTop: '20px' }}>
          <Button 
            as="a" 
            href="https://wa.me/972537230136?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%94%D7%92%D7%A2%D7%AA%D7%99%20%D7%93%D7%A8%D7%9A%20%D7%90%D7%AA%D7%A8%20Secril"
            target="_blank"
            rel="noopener noreferrer"
            className="primary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            צור קשר ב-WhatsApp
          </Button>
        </div>
      </div>
    </section>
  );
}
