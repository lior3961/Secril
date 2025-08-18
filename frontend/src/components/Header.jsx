import Button from './Button';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Header({ onOpenLogin, onOpenSignup, onOpenCart, onScrollAbout, onScrollContact }) {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();

  return (
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
          <Button className="primary" onClick={onOpenCart} aria-haspopup="dialog">
            🛒 סל הקניות {cartCount ? `(${cartCount})` : ''}
          </Button>
        </div>
      </div>
    </header>
  );
}
