import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getTokens } from '../lib/auth';
import Button from './Button';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [singleOrder, setSingleOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderId, setOrderId] = useState('');

  // Fetch user's orders if logged in
  useEffect(() => {
    if (user) {
      fetchUserOrders();
    }
  }, [user]);

  const fetchUserOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const { access } = getTokens();
      const data = await api('/api/orders', { token: access });
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const lookupOrder = async () => {
    if (!orderId.trim()) {
      setError('אנא הכנס מספר הזמנה');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api(`/api/orders/${orderId.trim()}`);
      setSingleOrder(data.order);
    } catch (err) {
      setError(err.message);
      setSingleOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'ממתין לאישור',
      'confirmed': 'מאושר',
      'shipped': 'נשלח',
      'delivered': 'נמסר',
      'cancelled': 'בוטל'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#f59e0b',
      'confirmed': '#3b82f6',
      'shipped': '#8b5cf6',
      'delivered': '#22c55e',
      'cancelled': '#ef4444'
    };
    return colorMap[status] || '#6b7280';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderOrder = (order) => (
    <div key={order.id} className="order-card">
      <div className="order-header">
        <div className="order-info">
          <h3>הזמנה #{order.id}</h3>
          <p className="order-date">{formatDate(order.created_at)}</p>
        </div>
        <div className="order-status">
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(order.status) }}
          >
            {getStatusText(order.status)}
          </span>
        </div>
      </div>
      
      <div className="order-details">
        <div className="order-section">
          <h4>כתובת למשלוח</h4>
          <p>
            {order.address || 'לא צוינה כתובת'}
            {order.city && `, ${order.city}`}
            {order.postal_code && `, ${order.postal_code}`}
          </p>
        </div>
        
        <div className="order-section">
          <h4>סכום כולל</h4>
          <p className="order-price">₪{order.price}</p>
        </div>
        
                 {order.products_arr && Array.isArray(order.products_arr) && order.products_arr.length > 0 && (
           <div className="order-section">
             <h4>מוצרים</h4>
             <div className="order-products">
               {order.products_arr.map((item, index) => (
                 <div key={index} className="order-product">
                   <div className="product-info">
                     {item.image_url && (
                       <img 
                         src={item.image_url} 
                         alt={item.name}
                         className="product-thumbnail"
                         onError={(e) => e.target.style.display = 'none'}
                       />
                     )}
                     <span className="product-name">{item.name || `מוצר ${index + 1}`}</span>
                   </div>
                   <div className="product-details">
                     <span className="quantity">כמות: {item.quantity}</span>
                     <span className="price">₪{item.price}</span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         )}
      </div>
    </div>
  );

  if (!user) {
    // Non-logged in users - show login prompt
    return (
      <section className="orders">
        <div className="container">
          <h2>ההזמנות שלי</h2>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>עליך להתחבר כדי לראות את ההזמנות שלך</p>
            <Button onClick={() => window.location.href = '/'}>
              חזרה לדף הבית
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Logged in users - their orders
  return (
    <section className="orders">
      <div className="container">
        <h2>ההזמנות שלי</h2>
        
        {/* Order Search */}
        <div className="order-search">
          <div className="search-form">
            <input
              type="text"
              placeholder="חיפוש לפי מספר הזמנה"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && lookupOrder()}
            />
                         <Button onClick={lookupOrder} disabled={loading}>
              {loading ? 'מחפש...' : 'חפש'}
            </Button>
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {singleOrder && (
            <div className="single-order">
              {renderOrder(singleOrder)}
            </div>
          )}
        </div>
        
        {/* All Orders */}
        <div className="all-orders">
          <h3>כל ההזמנות שלי</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              טוען הזמנות...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
              שגיאה בטעינת ההזמנות: {error}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>אין לך הזמנות עדיין</p>
              <Button onClick={() => window.location.href = '/'}>
                התחל לקנות
              </Button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map(renderOrder)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
