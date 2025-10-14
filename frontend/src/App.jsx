import { useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Products from './components/Products';
import About from './components/About';
import ContactForm from './components/ContactForm';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignUpForm';
import CartDrawer from './components/CartDrawer';
import Orders from './components/Orders';
import OrderSuccess from './components/OrderSuccess';
import OrderFailed from './components/OrderFailed';
import { CartProvider } from './context/CartContext';

function HomePage({ aboutRef, contactRef }) {
  return (
    <main>
      <Hero />
      <Products />
      <About refProp={aboutRef} />
      <ContactForm refProp={contactRef} onSubmit={(data) => console.log('Contact form:', data)} />
    </main>
  );
}

function AppContent() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  
  const aboutRef = useRef(null);
  const contactRef = useRef(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const scrollTo = (ref) => {
    // If not on home page, navigate to home first
    if (location.pathname !== '/') {
      navigate('/');
      // Wait for navigation to complete, then scroll
      setTimeout(() => {
        ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScrollAbout = () => scrollTo(aboutRef);
  const handleScrollContact = () => scrollTo(contactRef);

  return (
    <>
      <Header
        onOpenLogin={() => setLoginOpen(true)}
        onOpenSignup={() => setSignupOpen(true)}
        onOpenCart={() => setCartOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
        onScrollAbout={handleScrollAbout}
        onScrollContact={handleScrollContact}
      />

      <Routes>
        <Route path="/" element={<HomePage aboutRef={aboutRef} contactRef={contactRef} />} />
        <Route path="/products" element={<Products />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/order-failed" element={<OrderFailed />} />
      </Routes>

      <footer>
        <div className="container">
          <div className="footer-content">
            <div className="footer-main">
              © {new Date().getFullYear()} Secril — כל הזכויות שמורות.
            </div>
            <div className="footer-credit">
              בניית האתר ופיתוח - ליאור חגי
              <br />
              ליצירת קשר עבור בניית אפליקציות/אתרים באיכות גבוהה ובמחיר המשתלם ביותר צרו קשר:{' '}
              <a href="mailto:lior3961@gmail.com" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                lior3961@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Drawers/Modals */}
      {loginOpen && <LoginForm onClose={() => setLoginOpen(false)} onSubmit={(data) => console.log('Login:', data)} />}
      {signupOpen && <SignupForm onClose={() => setSignupOpen(false)} onSubmit={(data) => console.log('Signup:', data)} />}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      
      {/* Orders Modal */}
      {ordersOpen && (
        <div className="modal-overlay" onClick={() => setOrdersOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>הזמנות</h2>
              <button className="modal-close" onClick={() => setOrdersOpen(false)}>×</button>
            </div>
            <Orders />
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </Router>
  );
}
