import Button from './Button';
import { useAuth } from '../context/AuthContext';

export default function SignupForm({ onClose }) {
  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = Object.fromEntries(fd.entries());
    try {
      await signup({
        email: p.email,
        password: p.password,
        full_name: p.fullName,
        date_of_birth: p.date_of_birth || null
      });
      alert('נרשמת בהצלחה! ניתן להתחבר כעת.');
      onClose?.();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div role="dialog" aria-label="טופס הרשמה" className="section" style={{ background: '#fff' }}>
      <div className="container" style={{ maxWidth: 420 }}>
        <h2>הרשמה</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <input name="fullName" required placeholder="שם מלא" className="btn" style={{ textAlign: 'start' }} />
          <input name="email" type="email" required placeholder="אימייל" className="btn" style={{ textAlign: 'start' }} />
          <input name="password" type="password" required placeholder="סיסמה" className="btn" style={{ textAlign: 'start' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="primary" type="submit">הירשם</Button>
            <Button className="ghost" type="button" onClick={onClose}>סגור</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
