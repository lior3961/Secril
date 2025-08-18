import { useState } from 'react';
import Button from './Button';
import { api } from '../lib/api';

export default function ContactForm({ refProp, onSubmit }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    
    try {
      setLoading(true);
      await api('/api/contact', {
        method: 'POST',
        body: payload
      });
      setMessage('ההודעה נשלחה בהצלחה!');
      e.currentTarget.reset();
      onSubmit?.(payload);
    } catch (error) {
      setMessage('שגיאה בשליחת ההודעה: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" ref={refProp} className="section" style={{ background: '#fafafa' }}>
      <div className="container">
        <h2>צור קשר</h2>
        <p>שאלות? נשמח לעזור:</p>
        {message && (
          <div className={`contact-message ${message.includes('שגיאה') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <input name="name" required placeholder="שם מלא" className="btn" style={{ textAlign: 'start' }} />
          <input name="email" required type="email" placeholder="אימייל" className="btn" style={{ textAlign: 'start' }} />
          <textarea name="message" required rows="4" placeholder="הודעה" className="btn" style={{ textAlign: 'start', resize: 'vertical' }} />
          <Button className="primary" type="submit" disabled={loading}>
            {loading ? 'שולח...' : 'שליחה'}
          </Button>
        </form>
      </div>
    </section>
  );
}
