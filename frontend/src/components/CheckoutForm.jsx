import { useState } from 'react';
import Button from './Button';

export default function CheckoutForm({ onSubmit, onCancel, loading, deliveryType: initialDeliveryType = 'delivery', onDeliveryTypeChange, cartTotal = 0, deliveryFee = 10 }) {
  const [deliveryType, setDeliveryType] = useState(initialDeliveryType); // 'delivery' or 'pickup'
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    zipCode: ''
  });
  
  // Calculate total with delivery fee
  const finalTotal = deliveryType === 'delivery' ? cartTotal + deliveryFee : cartTotal;
  
  const handleDeliveryTypeChange = (newType) => {
    setDeliveryType(newType);
    if (onDeliveryTypeChange) {
      onDeliveryTypeChange(newType);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log('CheckoutForm submit:', {
      cartTotal,
      deliveryType,
      formData,
      deliveryFee
    });

    // Validate cart has items before submitting
    if (cartTotal <= 0) {
      alert('שגיאה: העגלה ריקה. אנא חזור ומוסיף מוצרים לעגלה.');
      return;
    }

    if (deliveryType === 'delivery' && (!formData.address || !formData.city || !formData.zipCode)) {
      alert('עליך למלא את כל פרטי המשלוח');
      return;
    }

    const checkoutData = {
      deliveryType,
      address: deliveryType === 'pickup' ? 'איסוף עצמי-הרטום 29ב, נתניה' : formData.address,
      city: deliveryType === 'pickup' ? 'נתניה' : formData.city,
      zipCode: deliveryType === 'pickup' ? '' : formData.zipCode
    };

    onSubmit(checkoutData);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="checkout-form">
      <h3>פרטי משלוח</h3>
      
      <form onSubmit={handleSubmit}>
        {/* Delivery Type Selection */}
        <div className="delivery-type">
          <label className="delivery-option">
            <input
              type="radio"
              name="deliveryType"
              value="delivery"
              checked={deliveryType === 'delivery'}
              onChange={(e) => handleDeliveryTypeChange(e.target.value)}
            />
            <span>משלוח לבית</span>
          </label>
          
          <label className="delivery-option">
            <input
              type="radio"
              name="deliveryType"
              value="pickup"
              checked={deliveryType === 'pickup'}
              onChange={(e) => handleDeliveryTypeChange(e.target.value)}
            />
            <span>איסוף עצמי - הרטום 29ב, נתניה</span>
          </label>
        </div>

        {/* Delivery Address Fields */}
        {deliveryType === 'delivery' && (
          <div className="address-fields">
            <input
              name="address"
              type="text"
              placeholder="כתובת למשלוח"
              value={formData.address}
              onChange={handleInputChange}
              required
              className="form-input"
            />
            
            <input
              name="city"
              type="text"
              placeholder="עיר"
              value={formData.city}
              onChange={handleInputChange}
              required
              className="form-input"
            />
            
            <input
              name="zipCode"
              type="text"
              placeholder="מיקוד"
              value={formData.zipCode}
              onChange={handleInputChange}
              required
              className="form-input"
            />
          </div>
        )}

        {/* Pickup Information */}
        {deliveryType === 'pickup' && (
          <div className="pickup-info">
            <p>איסוף עצמי: הרטום 29ב, נתניה</p>
            <p>שעות פעילות: א-ה 9:00-18:00, ו' 9:00-14:00</p>
          </div>
        )}

        {/* Order Total Summary */}
        <div className="checkout-total-summary">
          <div className="checkout-total-row">
            <span>סה"כ מוצרים:</span>
            <span>₪{Math.max(0, cartTotal).toFixed(2)}</span>
          </div>
          {deliveryType === 'delivery' && (
            <div className="checkout-total-row">
              <span>דמי משלוח:</span>
              <span>₪{deliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div className="checkout-total-row checkout-total-final">
            <strong>סה"כ לתשלום:</strong>
            <strong>₪{Math.max(0, finalTotal).toFixed(2)}</strong>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <Button 
            type="submit" 
            className="primary"
            disabled={loading}
          >
            {loading ? 'מעבד...' : 'השלם הזמנה'}
          </Button>
          
          <Button 
            type="button" 
            className="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            ביטול
          </Button>
        </div>
      </form>
    </div>
  );
}
