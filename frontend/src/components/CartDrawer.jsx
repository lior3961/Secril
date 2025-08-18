import Button from './Button';
import { useCart } from '../context/CartContext';

export default function CartDrawer({ open, onClose }) {
  const { items, cartTotal, removeFromCart, updateQuantity } = useCart();

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
      {items.length > 0 && (
        <div className="cart-footer">
          <div className="cart-total">
            <strong>סה"כ: ₪{cartTotal}</strong>
          </div>
          <Button className="primary" onClick={() => alert('לתשלום (דמו)')}>
            לתשלום
          </Button>
        </div>
      )}
    </aside>
  );
}
