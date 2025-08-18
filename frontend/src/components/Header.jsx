import { useState } from 'react';
import Button from './Button';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import AdminDashboard from './AdminDashboard';

export default function Header({ onOpenLogin, onOpenSignup, onOpenCart, onScrollAbout, onScrollContact, onOpenOrders }) {
  const { user, logout, isAdmin } = useAuth();
  const { cartCount } = useCart();
  const [adminOpen, setAdminOpen] = useState(false);

  // Debug logging
  console.log('Header - User:', user);
  console.log('Header - Is Admin:', isAdmin);

    return (
    <>
      <header>
        <div className="container nav">
          <div className="logo">Secril</div>
          <div className="actions">
            {!user ? (
              <>
                <Button className="ghost" onClick={onOpenLogin}>התחבר</Button>
                <Button onClick={onOpenSignup}>הירשם</Button>
              </>
            ) : (
              <Button className="ghost" onClick={logout}>התנתק</Button>
            )}
            <Button className="ghost" onClick={onScrollAbout}>קצת עלינו</Button>
            <Button className="ghost" onClick={onScrollContact}>צור קשר</Button>
            {user && (
              <>
                <Button className="ghost" onClick={onOpenOrders}>
                  📋 ההזמנות שלי
                </Button>
                <Button className="primary" onClick={onOpenCart} aria-haspopup="dialog">
                  🛒 סל הקניות {cartCount ? `(${cartCount})` : ''}
                </Button>
              </>
            )}
            
            {isAdmin && (
              <Button className="ghost" onClick={() => setAdminOpen(true)}>
                ⚙️ ניהול
              </Button>
            )}
          </div>
        </div>
      </header>
      
      {/* Admin Dashboard Modal */}
      {adminOpen && (
        <div className="modal-overlay" onClick={() => setAdminOpen(false)}>
          <div className="modal-content admin-modal" onClick={(e) => e.stopPropagation()}>
            <AdminDashboard onClose={() => setAdminOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
