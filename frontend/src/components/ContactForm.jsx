import Button from './Button';

export default function ContactForm({ refProp, onSubmit }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    onSubmit?.(payload); // נדלג להמשך
    alert('נשלח ✅ (דמו)');
    e.currentTarget.reset();
  };

  return (
    <section id="contact" ref={refProp} className="section" style={{ background: '#fafafa' }}>
      <div className="container">
        <h2>צור קשר</h2>
        <p>שאלות? נשמח לעזור:</p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <input name="name" required placeholder="שם מלא" className="btn" style={{ textAlign: 'start' }} />
          <input name="email" required type="email" placeholder="אימייל" className="btn" style={{ textAlign: 'start' }} />
          <textarea name="message" required rows="4" placeholder="הודעה" className="btn" style={{ textAlign: 'start', resize: 'vertical' }} />
          <Button className="primary" type="submit">שליחה</Button>
        </form>
      </div>
    </section>
  );
}
