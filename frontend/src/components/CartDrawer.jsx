import Button from './Button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { api } from '../lib/api';
import { getTokens } from '../lib/auth';
import CheckoutForm from './CheckoutForm';

export default function CartDrawer({ open, onClose }) {
  const { items, cartTotal, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      setCheckoutMessage('עליך להתחבר כדי להשלים את ההזמנה');
      return;
    }

    if (items.length === 0) {
      setCheckoutMessage('העגלה ריקה');
      return;
    }

    setShowCheckoutForm(true);
  };

  const handleCheckoutSubmit = async (checkoutData) => {
    try {
      setCheckoutLoading(true);
      setCheckoutMessage(null);

      // Prepare order data
      const products_arr = {
        products_ids: items.flatMap(item => 
          Array(item.quantity).fill(item.id)
        )
      };

      const orderData = {
        address: checkoutData.address,
        city: checkoutData.city,
        postal_code: checkoutData.zipCode,
        products_arr,
        price: cartTotal
      };

      // Get auth token
      const { access } = getTokens();
      
      // Create order
      await api('/api/orders', {
        method: 'POST',
        body: orderData,
        token: access
      });

      // Clear cart and show success message
      clearCart();
      setCheckoutMessage('ההזמנה הושלמה בהצלחה! מספר הזמנה יישלח למייל שלך');
      setShowCheckoutForm(false);
      
      // Close cart after 3 seconds
      setTimeout(() => {
        onClose();
        setCheckoutMessage(null);
      }, 3000);

    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutMessage('שגיאה בהשלמת ההזמנה: ' + error.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckoutCancel = () => {
    setShowCheckoutForm(false);
  };

  return (
    <aside className={`cart-drawer ${open ? 'open' : ''}`} role="dialog" aria-label="סל הקניות">
      <div className="cart-header">
        <strong>סל הקניות</strong>
        <Button className="ghost" onClick={onClose}>סגור</Button>
      </div>
      <div className="cart-items">
        {items.length === 0 ? (
          <p>העגלה ריקה כרגע.</p>
        ) : (
          <div className="cart-item-list">
            {items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <h4>{item.name}</h4>
                  <p className="cart-item-price">₪{item.price}</p>
                </div>
                <div className="cart-item-actions">
                  <div className="quantity-controls">
                    <button 
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="quantity">{item.quantity}</span>
                    <button 
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => removeFromCart(item.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {checkoutMessage && (
        <div className={`checkout-message ${checkoutMessage.includes('שגיאה') ? 'error' : 'success'}`}>
          {checkoutMessage}
        </div>
      )}
      
      {showCheckoutForm ? (
        <CheckoutForm
          onSubmit={handleCheckoutSubmit}
          onCancel={handleCheckoutCancel}
          loading={checkoutLoading}
        />
      ) : (
        items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <strong>סה"כ: ₪{cartTotal}</strong>
            </div>
            <Button 
              className="primary" 
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'מעבד...' : 'לתשלום'}
            </Button>
          </div>
        )
      )}
    </aside>
  );
}
