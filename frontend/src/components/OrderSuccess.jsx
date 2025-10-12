import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getTokens } from '../lib/auth';
import Button from './Button';

export default function OrderSuccess() {
  const [verifying, setVerifying] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      const lowProfileId = sessionStorage.getItem('pending_payment_id');
      
      if (!lowProfileId) {
        setError('לא נמצא מזהה תשלום');
        setVerifying(false);
        return;
      }

      const { access } = getTokens();
      
      // Wait a bit for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check payment status
      const response = await api(`/api/payments/status/${lowProfileId}`, {
        token: access
      });

      setStatus(response.status);
      
      // If still awaiting payment, try manual verification
      if (response.status === 'awaiting_payment') {
        await api(`/api/payments/verify/${lowProfileId}`, {
          method: 'POST',
          token: access
        });
        
        // Check status again
        const updatedResponse = await api(`/api/payments/status/${lowProfileId}`, {
          token: access
        });
        setStatus(updatedResponse.status);
      }

      // Clear pending payment from session
      if (response.status === 'payment_verified') {
        sessionStorage.removeItem('pending_payment_id');
      }

    } catch (err) {
      console.error('Payment verification error:', err);
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const getStatusMessage = () => {
    if (verifying) {
      return {
        title: 'מאמת תשלום...',
        message: 'אנא המתן, אנו מאמתים את התשלום שלך',
        icon: '⏳'
      };
    }

    if (error) {
      return {
        title: 'שגיאה',
        message: error,
        icon: '❌'
      };
    }

    switch (status) {
      case 'payment_verified':
        return {
          title: 'התשלום בוצע בהצלחה!',
          message: 'ההזמנה שלך התקבלה ותטופל בהקדם. פרטי ההזמנה נשלחו למייל שלך.',
          icon: '✅'
        };
      case 'failed':
        return {
          title: 'התשלום נכשל',
          message: 'התשלום לא הושלם בהצלחה. אנא נסה שנית.',
          icon: '❌'
        };
      case 'awaiting_payment':
        return {
          title: 'התשלום בתהליך',
          message: 'התשלום עדיין בתהליך. אנא המתן מספר דקות ובדוק שוב.',
          icon: '⏳'
        };
      default:
        return {
          title: 'סטטוס לא ידוע',
          message: 'לא הצלחנו לאמת את התשלום. אנא צור קשר עם התמיכה.',
          icon: '❓'
        };
    }
  };

  const message = getStatusMessage();

  return (
    <div className="order-success-container">
      <div className="order-success-card">
        <div className="success-icon">{message.icon}</div>
        <h1>{message.title}</h1>
        <p>{message.message}</p>
        
        {!verifying && (
          <div className="success-actions">
            {status === 'payment_verified' && (
              <Button 
                className="primary" 
                onClick={() => navigate('/orders')}
              >
                צפה בהזמנות שלי
              </Button>
            )}
            
            <Button 
              className="ghost" 
              onClick={() => navigate('/products')}
            >
              חזרה לחנות
            </Button>

            {status === 'awaiting_payment' && (
              <Button 
                className="secondary" 
                onClick={verifyPayment}
              >
                בדוק שוב
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

