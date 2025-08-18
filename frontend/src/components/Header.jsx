import Button from './Button';
import { useAuth } from '../context/AuthContext';

export default function Header({ onOpenLogin, onOpenSignup, onOpenCart, onScrollAbout, onScrollContact, cartCount = 0 }) {
  const { user, logout } = useAuth();

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
