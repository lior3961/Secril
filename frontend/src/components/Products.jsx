import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import Button from './Button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Notification from './Notification';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFeedbacks] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const productsGridRef = useRef(null);

    useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
                const data = await api('/api/products');
        console.log('Products fetched:', data.products);
        // Log image URLs for debugging
        data.products?.forEach(product => {
          if (product.image_url) {
            console.log(`Product "${product.name}" image URL:`, product.image_url);
          }
        });
        setProducts(data.products || []);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    
    // Listen for refresh events from cart checkout
    const handleRefresh = () => {
      console.log('Refreshing products after order...');
      fetchProducts();
    };
    
    window.addEventListener('refreshProducts', handleRefresh);
    
    // Refresh products every 30 seconds to catch updates
    const interval = setInterval(fetchProducts, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshProducts', handleRefresh);
    };
  }, []);

  const handleAddToCart = (product) => {
    if (!user) {
      setNotification('עליך להתחבר כדי להוסיף מוצרים לסל הקניות');
      return;
    }
    addToCart(product);
    setNotification(`נוסף ${product.name} לסל הקניות`);
  };

  const handleShowFeedbacks = async (product) => {
    try {
      // Fetch fresh product data to get updated feedbacks
      const data = await api('/api/products');
      const freshProduct = data.products.find(p => p.id === product.id);
      if (freshProduct) {
        setSelectedProduct(freshProduct);
        setShowFeedbacks(true);
      } else {
        setSelectedProduct(product);
        setShowFeedbacks(true);
      }
    } catch (err) {
      console.error('Error fetching fresh product data:', err);
      setSelectedProduct(product);
      setShowFeedbacks(true);
    }
  };

  const scrollProducts = (direction) => {
    if (productsGridRef.current) {
      const scrollAmount = 300; // Scroll by one card width + gap
      const currentScroll = productsGridRef.current.scrollLeft;
      
      if (direction === 'left') {
        productsGridRef.current.scrollTo({
          left: currentScroll - scrollAmount,
          behavior: 'smooth'
        });
      } else {
        productsGridRef.current.scrollTo({
          left: currentScroll + scrollAmount,
          behavior: 'smooth'
        });
      }
    }
  };

  if (loading) {
    return (
      <section className="products">
        <div className="container">
          <h2>מוצרים</h2>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            טוען מוצרים...
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="products">
        <div className="container">
          <h2>מוצרים</h2>
          <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
            שגיאה בטעינת המוצרים: {error}
          </div>
        </div>
      </section>
    );
  }

    if (showFeedbacks && selectedProduct) {
    console.log('Showing feedbacks for product:', selectedProduct);
    console.log('Product feedbacks:', selectedProduct.feedbacks);
    
    return (
      <>
        {notification && (
          <Notification
            message={notification}
            onClose={() => setNotification(null)}
          />
        )}
        <section className="products">
          <div className="container">
            <div className="feedbacks-header">
              <Button className="ghost" onClick={() => setShowFeedbacks(false)}>
                ← חזרה למוצרים
              </Button>
              <h2>מה אנשים אומרים - {selectedProduct.name}</h2>
            </div>

            <div className="feedbacks-list">
              {selectedProduct.feedbacks?.feedbacks?.length > 0 ? (
                selectedProduct.feedbacks.feedbacks.map((feedback, index) => (
                  <div key={index} className="feedback-item">
                    <div className="feedback-content">
                                             {feedback.image_url && (
                         <div className="feedback-image">
                           <img 
                             src={feedback.image_url} 
                             alt="תמונה למשוב" 
                             style={{ width: '280px', height: '400px', objectFit: 'cover', borderRadius: '12px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                           />
                         </div>
                       )}
                      <div className="feedback-text-content">
                        {feedback.text && <p className="feedback-text">"{feedback.text}"</p>}
                        {feedback.author && <p className="feedback-author">- {feedback.author}</p>}
                        <p className="feedback-date">
                          {new Date(feedback.date).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p>אין משובים למוצר זה</p>
              )}
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}
      <section className="products">
        <div className="container">
          <h2>מוצרים</h2>
                 {products.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '2rem' }}>
             אין מוצרים זמינים כרגע
           </div>
         ) : (
           <div className="products-container">
             <div className="products-grid" ref={productsGridRef}>
               {products.map((product) => (
                 <div key={product.id} className="product-card">
                                 <div className="product-image">
                   {product.image_url ? (
                     <>
                       <img 
                         src={product.image_url} 
                         alt={product.name}
                         onError={(e) => {
                           console.error('Image failed to load:', product.image_url);
                           e.target.style.display = 'none';
                           e.target.nextSibling.style.display = 'flex';
                         }}
                         onLoad={() => {
                           console.log('Image loaded successfully:', product.image_url);
                         }}
                       />
                       <div className="image-placeholder" style={{ display: 'none' }}>
                         📦
                       </div>
                     </>
                   ) : (
                     <div className="image-placeholder" style={{ display: 'flex' }}>
                       📦
                     </div>
                   )}
                 </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-description">{product.description}</p>
                                     <div className="product-price">
                     ₪{product.price.toFixed(2)}
                   </div>
                  <div className="product-status">
                    {product.quantity_in_stock > 0 ? (
                      <span className="in-stock">במלאי</span>
                    ) : (
                      <span className="out-of-stock">אזל המלאי</span>
                    )}
                  </div>
                  <div className="product-actions">
                    <Button
                      className="primary"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.quantity_in_stock === 0 || !user}
                      data-product-id={product.id}
                    >
                      {!user ? 'התחבר לקנייה' : (product.quantity_in_stock > 0 ? 'הוסף לסל' : 'אזל המלאי')}
                    </Button>
                    <Button
                      className="ghost"
                      onClick={() => handleShowFeedbacks(product)}
                    >
                      מה אנשים אומרים?
                    </Button>
                  </div>
                                 </div>
               </div>
             ))}
             </div>
             {products.length > 3 && (
               <div className="scroll-navigation">
                 <button 
                   className="scroll-btn scroll-left" 
                   onClick={() => scrollProducts('left')}
                   aria-label="גלול שמאלה"
                 >
                   ‹
                 </button>
                 <button 
                   className="scroll-btn scroll-right" 
                   onClick={() => scrollProducts('right')}
                   aria-label="גלול ימינה"
                 >
                   ›
                 </button>
               </div>
             )}
           </div>
         )}
        </div>
      </section>
    </>
  );
}
