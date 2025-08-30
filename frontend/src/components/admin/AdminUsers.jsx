import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getTokens } from '../../lib/auth';
import Button from '../Button';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { access } = getTokens();
      const data = await api('/api/admin/users', { token: access });
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      setLoading(true);
      const { access } = getTokens();
      const data = await api(`/api/admin/users/${userId}`, { token: access });
      setSelectedUser(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { access } = getTokens();
      await api(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        token: access,
        body: { status: newStatus }
      });
      // Refresh user details to show updated order status
      if (selectedUser) {
        fetchUserDetails(selectedUser.user.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (selectedUser) {
    return (
      <div className="user-details">
        <div className="user-details-header">
          <Button className="ghost" onClick={() => setSelectedUser(null)}>
            ← חזרה לרשימת משתמשים
          </Button>
        </div>

        <div className="user-info">
          <h3>פרטי משתמש</h3>
          <div className="user-info-grid">
            <div className="info-item">
              <label>שם מלא:</label>
              <span>{selectedUser.user.full_name || 'לא צוין'}</span>
            </div>
            <div className="info-item">
              <label>אימייל:</label>
              <span>{selectedUser.user.email}</span>
            </div>
            <div className="info-item">
              <label>טלפון:</label>
              <span>{selectedUser.user.phone || 'לא צוין'}</span>
            </div>
            <div className="info-item">
              <label>תאריך לידה:</label>
              <span>{selectedUser.user.date_of_birth ? formatDate(selectedUser.user.date_of_birth) : 'לא צוין'}</span>
            </div>
            <div className="info-item">
              <label>תאריך הרשמה:</label>
              <span>{formatDate(selectedUser.user.created_at)}</span>
            </div>
            <div className="info-item">
              <label>מנהל:</label>
              <span>{selectedUser.user.is_admin ? 'כן' : 'לא'}</span>
            </div>
          </div>
        </div>

        <div className="user-orders">
          <h3>הזמנות ({selectedUser.orders.length})</h3>
          {selectedUser.orders.length === 0 ? (
            <p>אין הזמנות למשתמש זה</p>
          ) : (
            <div className="orders-list">
              {selectedUser.orders.map(order => (
                <div key={order.id} className="order-item">
                  <div className="order-header">
                    <h4>הזמנה #{order.id}</h4>
                    <span className="order-date">{formatDate(order.created_at)}</span>
                    <div className="order-status-controls">
                      <span className="order-status">{order.status}</span>
                                             <select 
                         value={order.status} 
                         onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                         className="status-select"
                       >
                         <option value="ממתינה">ממתינה</option>
                         <option value="בטיפול">בטיפול</option>
                         <option value="סופק לשליח">סופק לשליח</option>
                         <option value="מוכנה לאיסוף">מוכנה לאיסוף</option>
                         <option value="סופקה">סופקה</option>
                         <option value="בוטלה">בוטלה</option>
                       </select>
                    </div>
                  </div>
                  <div className="order-details">
                    <p>כתובת: {order.address}, {order.city}, {order.postal_code}</p>
                    <p>סכום: ₪{order.price.toFixed(2)}</p>
                    <div className="order-products">
                      {order.products_arr && order.products_arr.map((product, index) => (
                        <span key={index} className="product-tag">
                          {product.name} (x{product.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-users">
      <h3>רשימת משתמשים ({users.length})</h3>
      
      <div className="users-table">
        <div className="table-header">
          <div className="header-cell">שם</div>
          <div className="header-cell">אימייל</div>
          <div className="header-cell">טלפון</div>
          <div className="header-cell">תאריך הרשמה</div>
          <div className="header-cell">מנהל</div>
          <div className="header-cell">פעולות</div>
        </div>

        <div className="table-body">
          {users.map(user => (
            <div key={user.id} className="table-row">
              <div className="table-cell">{user.full_name || 'לא צוין'}</div>
              <div className="table-cell">{user.email}</div>
              <div className="table-cell">{user.phone || 'לא צוין'}</div>
              <div className="table-cell">{formatDate(user.created_at)}</div>
              <div className="table-cell">
                <span className={`admin-badge ${user.is_admin ? 'admin' : 'user'}`}>
                  {user.is_admin ? 'מנהל' : 'משתמש'}
                </span>
              </div>
              <div className="table-cell">
                <Button 
                  className="ghost" 
                  onClick={() => fetchUserDetails(user.id)}
                >
                  צפה בפרטים
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
