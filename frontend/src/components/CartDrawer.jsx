import Button from './Button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { api } from '../lib/api';
import { getTokens } from '../lib/auth';
import CheckoutForm from './CheckoutForm';
import TermsModal from './TermsModal';

export default function CartDrawer({ open, onClose }) {
  const { items, cartTotal, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [deliveryType, setDeliveryType] = useState('delivery'); // Track delivery type
  
  // Delivery fee constant
  const DELIVERY_FEE = 10;
  
  // Calculate total with delivery fee
  const calculateTotal = () => {
    return deliveryType === 'delivery' ? cartTotal + DELIVERY_FEE : cartTotal;
  };
  
  const finalTotal = calculateTotal();

  const handleCheckout = async () => {
    if (!user) {
      setCheckoutMessage('עליך להתחבר כדי להשלים את ההזמנה');
      return;
    }

    if (items.length === 0) {
      setCheckoutMessage('העגלה ריקה');
      return;
    }

    if (!termsAccepted) {
      setCheckoutMessage('עליך לאשר את התקנון כדי להמשיך');
      return;
    }

    setShowCheckoutForm(true);
  };

  const handleCheckoutSubmit = async (checkoutData) => {
    try {
      setCheckoutLoading(true);
      setCheckoutMessage(null);
      
      // Validate cart has items
      if (items.length === 0) {
        setCheckoutMessage('העגלה ריקה - אין מוצרים להזמנה');
        setCheckoutLoading(false);
        return;
      }
      
      // Update delivery type from checkout form
      setDeliveryType(checkoutData.deliveryType);

      // Prepare order data
      const products_arr = {
        products_ids: items.flatMap(item => 
          Array(item.quantity).fill(item.id)
        )
      };
      
      // Validate products_arr is not empty
      if (!products_arr.products_ids || products_arr.products_ids.length === 0) {
        setCheckoutMessage('שגיאה: אין מוצרים בעגלה');
        setCheckoutLoading(false);
        return;
      }
      
      // Calculate total with delivery fee
      const deliveryFee = checkoutData.deliveryType === 'delivery' ? DELIVERY_FEE : 0;
      const totalPrice = cartTotal + deliveryFee;
      
      // Validate total price is correct
      if (totalPrice <= 0 || (deliveryFee > 0 && totalPrice <= deliveryFee)) {
        setCheckoutMessage('שגיאה: סכום הזמנה לא תקין');
        setCheckoutLoading(false);
        return;
      }

      const orderData = {
        address: checkoutData.address,
        city: checkoutData.city,
        postal_code: checkoutData.zipCode,
        products_arr,
        price: totalPrice,
        delivery_type: checkoutData.deliveryType
      };
      
      console.log('Submitting order:', {
        productsCount: products_arr.products_ids.length,
        cartTotal,
        deliveryFee,
        totalPrice,
        itemsCount: items.length
      });

      // Get auth token
      const { access } = getTokens();
      
      // Initiate CardCom payment
      const response = await api('/api/payments/initiate', {
        method: 'POST',
        body: orderData,
        token: access
      });

      // Validate response
      if (!response || !response.paymentUrl) {
        setCheckoutMessage('שגיאה ביצירת דף תשלום');
        setCheckoutLoading(false);
        return;
      }

      // Save lowProfileId to sessionStorage for later verification
      sessionStorage.setItem('pending_payment_id', response.lowProfileId);
      
      // Clear cart only after successful payment initiation
      clearCart();
      
      // Redirect to CardCom payment page
      window.location.href = response.paymentUrl;

    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutMessage('שגיאה ביצירת דף תשלום: ' + error.message);
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
                   <p className="cart-item-price">₪{item.price.toFixed(2)}</p>
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
          deliveryType={deliveryType}
          onDeliveryTypeChange={setDeliveryType}
          cartTotal={cartTotal}
          deliveryFee={DELIVERY_FEE}
        />
      ) : (
        items.length > 0 && (
          <>
            <div className="terms-acceptance">
              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>אני מאשר את ה</span>
                <button
                  type="button"
                  className="terms-link"
                  onClick={() => setShowTermsModal(true)}
                >
                  תקנון האתר
                </button>
              </label>
            </div>
            
            <div className="cart-footer">
              <div className="cart-total">
                <div className="cart-total-breakdown">
                  <div className="cart-subtotal">
                    <span>סה"כ מוצרים: ₪{cartTotal.toFixed(2)}</span>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className="cart-delivery-fee">
                      <span>דמי משלוח: ₪{DELIVERY_FEE.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="cart-final-total">
                    <strong>סה"כ לתשלום: ₪{finalTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
              <Button 
                className="primary" 
                onClick={handleCheckout}
                disabled={checkoutLoading || !termsAccepted}
              >
                {checkoutLoading ? 'מעבד...' : 'לתשלום'}
              </Button>
            </div>
          </>
        )
      )}
      
      <TermsModal 
        isOpen={showTermsModal} 
        onClose={() => setShowTermsModal(false)} 
      />
    </aside>
  );
}
