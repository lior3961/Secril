import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getTokens } from '../../lib/auth';
import Button from '../Button';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api('/api/products');
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      quantity_in_stock: parseInt(formData.get('quantity_in_stock')),
      image_url: formData.get('image_url')
    };

    try {
      setLoading(true);
      const { access } = getTokens();
      
      if (editingProduct) {
        await api(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: productData,
          token: access
        });
      } else {
        await api('/api/admin/products', {
          method: 'POST',
          body: productData,
          token: access
        });
      }
      
      await fetchProducts();
      setShowForm(false);
      setEditingProduct(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) return;

    try {
      setLoading(true);
      const { access } = getTokens();
      await api(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        token: access
      });
      await fetchProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (showForm) {
    return (
      <div className="product-form">
        <h3>{editingProduct ? 'עריכת מוצר' : 'הוספת מוצר חדש'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>שם המוצר:</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={editingProduct?.name || ''}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>תיאור:</label>
            <textarea
              name="description"
              defaultValue={editingProduct?.description || ''}
              className="form-input"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>מחיר:</label>
            <input
              name="price"
              type="number"
              step="0.01"
              required
              defaultValue={editingProduct?.price || ''}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>כמות במלאי:</label>
            <input
              name="quantity_in_stock"
              type="number"
              required
              defaultValue={editingProduct?.quantity_in_stock || 0}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>URL תמונה:</label>
            <input
              name="image_url"
              type="url"
              defaultValue={editingProduct?.image_url || ''}
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <Button type="submit" className="primary" disabled={loading}>
              {loading ? 'שומר...' : (editingProduct ? 'עדכן' : 'הוסף')}
            </Button>
            <Button type="button" className="ghost" onClick={handleCancel}>
              ביטול
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-products">
      <div className="products-header">
        <h3>ניהול מוצרים ({products.length})</h3>
        <Button className="primary" onClick={() => setShowForm(true)}>
          + הוסף מוצר חדש
        </Button>
      </div>

      <div className="products-grid">
        {products.map(product => (
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
              <h4>{product.name}</h4>
              <p className="product-description">{product.description}</p>
              <div className="product-price">₪{product.price}</div>
              <div className="product-stock">
                במלאי: {product.quantity_in_stock}
              </div>
            </div>

            <div className="product-actions">
              <Button 
                className="ghost" 
                onClick={() => handleEdit(product)}
              >
                ערוך
              </Button>
              <Button 
                className="ghost" 
                onClick={() => handleDelete(product.id)}
                style={{ color: '#ef4444' }}
              >
                מחק
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
