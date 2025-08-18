import Button from './Button';
import { useAuth } from '../context/AuthContext';

export default function LoginForm({ onClose }) {
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      await login({ email: payload.email, password: payload.password });
      onClose?.();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div role="dialog" aria-label="טופס התחברות" className="section" style={{ background: '#fff' }}>
      <div className="container" style={{ maxWidth: 420 }}>
        <h2>התחברות</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <input name="email" type="email" required placeholder="אימייל" className="btn" style={{ textAlign: 'start' }} />
          <input name="password" type="password" required placeholder="סיסמה" className="btn" style={{ textAlign: 'start' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="primary" type="submit">התחבר</Button>
            <Button className="ghost" type="button" onClick={onClose}>סגור</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
