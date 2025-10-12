import { useNavigate } from 'react-router-dom';
import Button from './Button';

export default function OrderFailed() {
  const navigate = useNavigate();

  // Clear pending payment from session
  sessionStorage.removeItem('pending_payment_id');

  return (
    <div className="order-failed-container">
      <div className="order-failed-card">
        <div className="failed-icon">❌</div>
        <h1>התשלום נכשל</h1>
        <p>התשלום לא הושלם בהצלחה.</p>
        <p>ייתכן שהכרטיס שלך נדחה או שהתהליך בוטל.</p>
        
        <div className="failed-actions">
          <Button 
            className="primary" 
            onClick={() => navigate('/products')}
          >
            נסה שוב
          </Button>
          
          <Button 
            className="ghost" 
            onClick={() => navigate('/')}
          >
            חזרה לדף הבית
          </Button>
        </div>
      </div>
    </div>
  );
}

