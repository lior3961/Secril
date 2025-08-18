import { useRef, useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import ContactForm from './components/ContactForm';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignUpForm';
import CartDrawer from './components/CartDrawer';

export default function App() {
  const aboutRef = useRef(null);
  const contactRef = useRef(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [cartItems] = useState([]); // דמו
  const cartCount = cartItems.length;

  const scrollTo = (ref) => ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <Header
        onOpenLogin={() => setLoginOpen(true)}
        onOpenSignup={() => setSignupOpen(true)}
        onOpenCart={() => setCartOpen(true)}
        onScrollAbout={() => scrollTo(aboutRef)}
        onScrollContact={() => scrollTo(contactRef)}
        cartCount={cartCount}
      />

      <main>
        <Hero onStartShopping={() => alert('דף חנות יגיע בקרוב')} onScrollAbout={() => scrollTo(aboutRef)} />
        <About refProp={aboutRef} />
        <ContactForm refProp={contactRef} onSubmit={(data) => console.log('Contact form:', data)} />
      </main>

      <footer>
        <div className="container">
          © {new Date().getFullYear()} Secril — כל הזכויות שמורות.
        </div>
      </footer>

      {/* Drawers/Modals (דמו בלי רקע מושחר) */}
      {loginOpen && <LoginForm onClose={() => setLoginOpen(false)} onSubmit={(data) => console.log('Login:', data)} />}
      {signupOpen && <SignupForm onClose={() => setSignupOpen(false)} onSubmit={(data) => console.log('Signup:', data)} />}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} />
    </>
  );
}
