import { useState, useEffect } from 'react';
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
  const [showFeedbacks, setShowFeedbacks] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

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
    
    // Refresh products every 30 seconds to catch updates
    const interval = setInterval(fetchProducts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAddToCart = (product) => {
    if (!user) {
      setNotification('עליך להתחבר כדי להוסיף מוצרים לסל הקניות');
      return;
    }
    addToCart(product);
    setNotification(`נוסף ${product.name} לסל הקניות`);
  };

  const handleShowFeedbacks = (product) => {
    setSelectedProduct(product);
    setShowFeedbacks(true);
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
                      <p className="feedback-text">"{feedback.text}"</p>
                      <p className="feedback-author">- {feedback.author}</p>
                      <p className="feedback-date">
                        {new Date(feedback.date).toLocaleDateString('he-IL')}
                      </p>
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
          <div className="products-grid">
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
                    ₪{product.price}
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
        )}
        </div>
      </section>
    </>
  );
}
