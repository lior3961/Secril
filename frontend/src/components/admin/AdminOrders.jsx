import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getTokens } from '../../lib/auth';
import Button from '../Button';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { access } = getTokens();
      const data = await api(`/api/admin/orders?status=${statusFilter}`, { token: access });
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setLoading(true);
      const { access } = getTokens();
      await api(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status: newStatus },
        token: access
      });
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'ממתינה': 'ממתינה',
      'בטיפול': 'בטיפול',
      'סופק לשליח': 'סופק לשליח',
      'מוכנה לאיסוף': 'מוכנה לאיסוף',
      'סופקה': 'סופקה',
      'בוטלה': 'בוטלה'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'ממתינה': '#f59e0b',
      'בטיפול': '#3b82f6',
      'סופק לשליח': '#8b5cf6',
      'מוכנה לאיסוף': '#10b981',
      'סופקה': '#22c55e',
      'בוטלה': '#ef4444'
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

  const statusOptions = [
    { value: 'all', label: 'כל ההזמנות' },
    { value: 'ממתינה', label: 'ממתינה' },
    { value: 'בטיפול', label: 'בטיפול' },
    { value: 'סופק לשליח', label: 'סופק לשליח' },
    { value: 'מוכנה לאיסוף', label: 'מוכנה לאיסוף' },
    { value: 'סופקה', label: 'סופקה' },
    { value: 'בוטלה', label: 'בוטלה' }
  ];

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="admin-orders">
      <div className="orders-header">
        <h3>ניהול הזמנות ({orders.length})</h3>
        
        <div className="status-filter">
          <label>סטטוס:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>אין הזמנות בסטטוס זה</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div className="order-info">
                  <h4>הזמנה #{order.id}</h4>
                  <p className="order-date">{formatDate(order.created_at)}</p>
                  <p className="customer-info">
                    לקוח: {order.user?.full_name || 'לא צוין'} ({order.user?.email})
                    {order.user?.phone && <span> | טלפון: {order.user.phone}</span>}
                  </p>
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
                <div className="address-info">
                  <strong>כתובת למשלוח:</strong>
                  <p>{order.address}, {order.city}, {order.postal_code}</p>
                </div>

                <div className="price-info">
                  <strong>סכום כולל:</strong>
                  <span className="order-price">₪{order.price.toFixed(2)}</span>
                </div>

                <div className="products-info">
                  <strong>מוצרים:</strong>
                  <div className="products-list">
                    {order.products_arr && order.products_arr.map((product, index) => (
                      <div key={index} className="product-item">
                        <span className="product-name">{product.name}</span>
                        <span className="product-quantity">x{product.quantity}</span>
                        <span className="product-price">₪{product.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="status-actions">
                  <strong>שנה סטטוס:</strong>
                  <div className="status-buttons">
                    {statusOptions.filter(option => option.value !== 'all').map(option => (
                      <Button
                        key={option.value}
                        className={order.status === option.value ? 'primary' : 'ghost'}
                        onClick={() => updateOrderStatus(order.id, option.value)}
                        disabled={loading}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
