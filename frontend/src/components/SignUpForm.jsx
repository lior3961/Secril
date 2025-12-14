import { useRef } from 'react';
import Button from './Button';
import { useAuth } from '../context/AuthContext';

export default function SignupForm({ onClose }) {
  const { signup } = useAuth();
  const phoneRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = Object.fromEntries(fd.entries());
    
    // Get phone directly from ref as fallback
    const phoneValue = phoneRef.current?.value || p.phone;
    
    // Debug logging
    console.log('Form data entries:', Array.from(fd.entries()));
    console.log('Parsed form data:', p);
    console.log('Phone from FormData:', p.phone);
    console.log('Phone from ref:', phoneRef.current?.value);
    console.log('Final phone value:', phoneValue);
    
    try {
      const response = await signup({
        email: p.email,
        password: p.password,
        full_name: p.fullName,
        date_of_birth: p.date_of_birth || null,
        phone: phoneValue || null
      });
      
      // Check if auto-login was successful
      if (response.session) {
        alert('נרשמת בהצלחה! התחברת אוטומטית.');
      } else {
        alert('נרשמת בהצלחה! ניתן להתחבר כעת.');
      }
      onClose?.();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הרשמה</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>שם מלא:</label>
              <input 
                name="fullName" 
                type="text" 
                required 
                placeholder="הכנס את השם המלא שלך" 
                className="form-input" 
              />
            </div>
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
                minLength="6"
                placeholder="הכנס סיסמה (מינימום 6 תווים)" 
                className="form-input" 
              />
              <small className="form-hint">הסיסמה חייבת להכיל לפחות 6 תווים</small>
            </div>
            <div className="form-group">
              <label>טלפון:</label>
              <input 
                ref={phoneRef}
                name="phone" 
                type="tel" 
                required
                placeholder="הכנס מספר טלפון" 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>תאריך לידה:</label>
              <input 
                name="date_of_birth" 
                type="date" 
                className="form-input" 
              />
            </div>
            <div className="form-actions">
              <Button className="primary" type="submit">הירשם</Button>
              <Button className="ghost" type="button" onClick={onClose}>ביטול</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
