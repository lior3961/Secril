import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Button from './Button';
import { useCart } from '../context/CartContext';
import Notification from './Notification';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await api('/api/products');
        setProducts(data.products || []);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleAddToCart = (product) => {
    addToCart(product);
    setNotification(`נוסף ${product.name} לסל הקניות`);
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
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="image-placeholder" style={{ display: product.image_url ? 'none' : 'flex' }}>
                    📦
                  </div>
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
                  <Button
                    className="primary"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.quantity_in_stock === 0}
                    data-product-id={product.id}
                  >
                    {product.quantity_in_stock > 0 ? 'הוסף לסל' : 'אזל המלאי'}
                  </Button>
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
