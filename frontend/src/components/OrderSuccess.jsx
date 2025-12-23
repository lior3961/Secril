import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getTokens } from '../lib/auth';
import Button from './Button';

export default function OrderSuccess() {
  const [verifying, setVerifying] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Try multiple methods to get lowProfileId:
      // 1. URL query parameters (CardCom might include it)
      // 2. sessionStorage (saved before redirect)
      // 3. Most recent pending order for user (fallback)
      let lowProfileId = searchParams.get('LowProfileId') || 
                         searchParams.get('lowProfileId') ||
                         sessionStorage.getItem('pending_payment_id');
      
      // If still not found, try to get from user's recent pending orders
      if (!lowProfileId) {
        try {
          const { access } = getTokens();
          // Try to get the most recent pending order
          const recentOrder = await api('/api/payments/recent', {
            token: access
          });
          if (recentOrder?.lowProfileId) {
            lowProfileId = recentOrder.lowProfileId;
            // Save it for future use
            sessionStorage.setItem('pending_payment_id', lowProfileId);
          }
        } catch (recentErr) {
          console.log('Could not fetch recent orders:', recentErr);
        }
      }
      
      if (!lowProfileId) {
        setError('לא נמצא מזהה תשלום');
        setVerifying(false);
        return;
      }
      
      // Save to sessionStorage if we got it from URL params
      if (!sessionStorage.getItem('pending_payment_id') && lowProfileId) {
        sessionStorage.setItem('pending_payment_id', lowProfileId);
      }

      const { access } = getTokens();
      
      // Wait a bit for webhook to process (Bit app payments can be very fast)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check payment status with extended polling for Bit app payments
      // Bit app webhooks can take longer to process due to retry logic
      let currentStatus = null;
      let lastError = null;
      const maxAttempts = 30; // Up to 30 attempts = ~60 seconds total
      const initialDelay = 1000; // Start with 1 second
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await api(`/api/payments/status/${lowProfileId}`, {
            token: access
          });
          currentStatus = response.status;
          setStatus(currentStatus);
          lastError = null; // Clear error on successful response

          // If still awaiting payment, try manual verification once (after a few attempts)
          if (currentStatus === 'awaiting_payment' && attempt === 2) {
            try {
              await api(`/api/payments/verify/${lowProfileId}`, {
                method: 'POST',
                token: access
              });
            } catch (verifyErr) {
              // Ignore verification errors, continue polling
              console.log('Manual verification attempt failed, continuing to poll:', verifyErr);
            }
          }

          // Break on terminal states
          if (currentStatus === 'payment_verified' || currentStatus === 'failed') {
            break;
          }

          // Calculate delay with exponential backoff for 'awaiting_payment' status
          // This gives more time for Bit app webhooks to process
          let delay = initialDelay;
          if (currentStatus === 'awaiting_payment' && attempt > 5) {
            // After 5 attempts, increase delay for awaiting_payment
            delay = Math.min(initialDelay * 2, 3000); // Max 3 seconds
          } else if (currentStatus === 'processing') {
            // Processing state - check more frequently
            delay = 1000;
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (err) {
          // Handle 404 errors gracefully (payment might not be found yet)
          if (err.status === 404 || err.message?.includes('not found')) {
            lastError = null; // Don't treat 404 as error initially
            currentStatus = 'awaiting_payment';
            setStatus('awaiting_payment');
            
            // Wait longer if payment not found (might still be processing)
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            lastError = err;
            console.error('Payment status check error:', err);
            // Continue polling even on error (might be transient)
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // If we still don't have a terminal status after all attempts
      if (currentStatus !== 'payment_verified' && currentStatus !== 'failed') {
        if (lastError) {
          setError(lastError.message || 'לא הצלחנו לאמת את התשלום');
        } else {
          // Still processing - show processing message instead of error
          setStatus('processing');
        }
      }

      // Clear pending payment from session
      if (currentStatus === 'payment_verified') {
        sessionStorage.removeItem('pending_payment_id');
      }

    } catch (err) {
      console.error('Payment verification error:', err);
      setError(err.message || 'שגיאה באימות התשלום');
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
          message: 'ההזמנה שלך התקבלה ותטופל בהקדם. תוכל לעקוב אחר ההזמנה שלך תחת "ההזמנות שלי".',
          icon: '✅'
        };
      case 'failed':
        return {
          title: 'התשלום נכשל',
          message: 'התשלום לא הושלם בהצלחה. אנא נסה שנית.',
          icon: '❌'
        };
      case 'processing':
        return {
          title: 'התשלום בתהליך',
          message: 'התשלום נקלט ומעובד כעת. זה ייקח מספר שניות...',
          icon: '⏳'
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
            <Button 
              className="primary" 
              onClick={() => navigate('/')}
            >
              חזרה לדף הבית
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

