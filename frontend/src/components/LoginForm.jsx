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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>התחברות</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>אימייל:</label>
              <input 
                name="email" 
                type="email" 
                required 
                placeholder="הכנס את האימייל שלך" 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>סיסמה:</label>
              <input 
                name="password" 
                type="password" 
                required 
                placeholder="הכנס את הסיסמה שלך" 
                className="form-input" 
              />
            </div>
            <div className="form-actions">
              <Button className="primary" type="submit">התחבר</Button>
              <Button className="ghost" type="button" onClick={onClose}>ביטול</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
