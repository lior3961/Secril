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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFeedbacks, setShowFeedbacks] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api('/api/products');
      console.log('Fetched products:', data.products);
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
    
    try {
      setLoading(true);
      const { access } = getTokens();
      
      // Handle image upload if file is selected
      let imageUrl = formData.get('image_url');
      const imageFile = formData.get('image_file');
      
      if (imageFile && imageFile.size > 0) {
        // Convert file to base64 and compress
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(imageFile);
        });
        
        let base64Data = await base64Promise;
        
        // Compress image if it's large
        if (imageFile.size > 1024 * 1024) { // If larger than 1MB
          base64Data = await compressImage(base64Data);
        }
        
        const fileName = `product_${Date.now()}_${imageFile.name}`;
        
        // Upload image
        const uploadResponse = await api('/api/admin/products/upload-image', {
          method: 'POST',
          body: { imageData: base64Data, fileName },
          token: access
        });
        
        imageUrl = uploadResponse.url;
      }
      
      const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        quantity_in_stock: parseInt(formData.get('quantity_in_stock')),
        image_url: imageUrl
      };
      
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

  const handleShowFeedbacks = (product) => {
    console.log('Showing feedbacks for product:', product);
    console.log('Product feedbacks:', product.feedbacks);
    setSelectedProduct(product);
    setShowFeedbacks(true);
  };

  const handleAddFeedback = () => {
    setEditingFeedback({ text: '', author: '' });
  };

  const handleEditFeedback = (feedback, index) => {
    setEditingFeedback({ ...feedback, index });
  };

  const handleDeleteFeedback = async (index) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משוב זה?')) return;

    try {
      const { access } = getTokens();
      const updatedFeedbacks = selectedProduct.feedbacks?.feedbacks?.filter((_, i) => i !== index) || [];
      
      await api(`/api/admin/products/${selectedProduct.id}/feedbacks`, {
        method: 'PUT',
        body: { feedbacks: { feedbacks: updatedFeedbacks } },
        token: access
      });
      
      // Refresh products to get updated data
      await fetchProducts();
      await refreshSelectedProduct();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      const { access } = getTokens();
      
      // Handle feedback image upload if file is selected
      let imageUrl = null;
      const imageFile = formData.get('feedback_image');
      
      if (imageFile && imageFile.size > 0) {
        // Convert file to base64 and compress
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(imageFile);
        });
        
        let base64Data = await base64Promise;
        
        // Compress image if it's large
        if (imageFile.size > 1024 * 1024) { // If larger than 1MB
          base64Data = await compressImage(base64Data);
        }
        
        const fileName = `feedback_${Date.now()}_${imageFile.name}`;
        
        // Upload image to feedbacks bucket
        const uploadResponse = await api('/api/admin/feedbacks/upload-image', {
          method: 'POST',
          body: { imageData: base64Data, fileName },
          token: access
        });
        
        imageUrl = uploadResponse.url;
      }
      
      const feedbackData = {
        text: formData.get('text') || null,
        author: formData.get('author') || null,
        date: new Date().toISOString(),
        image_url: imageUrl
      };

      const currentFeedbacks = selectedProduct.feedbacks?.feedbacks || [];
      let updatedFeedbacks;

      if (editingFeedback.index !== undefined) {
        // Editing existing feedback
        updatedFeedbacks = [...currentFeedbacks];
        updatedFeedbacks[editingFeedback.index] = feedbackData;
      } else {
        // Adding new feedback
        updatedFeedbacks = [...currentFeedbacks, feedbackData];
      }

      await api(`/api/admin/products/${selectedProduct.id}/feedbacks`, {
        method: 'PUT',
        body: { feedbacks: { feedbacks: updatedFeedbacks } },
        token: access
      });

      // Refresh products to get updated data
      await fetchProducts();
      await refreshSelectedProduct();
      setEditingFeedback(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const refreshSelectedProduct = async () => {
    try {
      const freshProducts = await api('/api/products');
      const updatedProduct = freshProducts.products.find(p => p.id === selectedProduct.id);
      setSelectedProduct(updatedProduct);
    } catch (err) {
      console.error('Error refreshing selected product:', err);
    }
  };

  // Image compression function
  const compressImage = (imageData) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 800px width/height)
        let { width, height } = img;
        const maxSize = 800;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with quality 0.8
        const compressedData = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedData);
      };
      img.src = imageData;
    });
  };

  const handleCancelFeedback = () => {
    setEditingFeedback(null);
  };

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (showFeedbacks && selectedProduct) {
    return (
      <div className="feedbacks-view">
        <div className="feedbacks-header">
          <Button className="ghost" onClick={() => setShowFeedbacks(false)}>
            ← חזרה למוצרים
          </Button>
          <h3>משובים - {selectedProduct.name}</h3>
          <Button className="primary" onClick={handleAddFeedback}>
            + הוסף משוב
          </Button>
        </div>

        {editingFeedback ? (
          <div className="feedback-form">
            <h4>{editingFeedback.index !== undefined ? 'עריכת משוב' : 'הוספת משוב חדש'}</h4>
            <form onSubmit={handleSaveFeedback}>
                             <div className="form-group">
                 <label>שם הכותב (אופציונלי):</label>
                 <input
                   name="author"
                   type="text"
                   defaultValue={editingFeedback.author}
                   className="form-input"
                 />
               </div>
               <div className="form-group">
                 <label>המשוב (אופציונלי):</label>
                 <textarea
                   name="text"
                   defaultValue={editingFeedback.text}
                   className="form-input"
                   rows="4"
                 />
               </div>
              <div className="form-group">
                <label>תמונה (אופציונלי):</label>
                <input
                  name="feedback_image"
                  type="file"
                  accept="image/*"
                  className="form-input"
                />
                {editingFeedback.image_url && (
                  <div className="current-feedback-image">
                    <p>תמונה נוכחית:</p>
                    <img 
                      src={editingFeedback.image_url} 
                      alt="תמונה נוכחית" 
                      style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                    />
                  </div>
                )}
              </div>
              <div className="form-actions">
                <Button type="submit" className="primary">
                  {editingFeedback.index !== undefined ? 'עדכן' : 'הוסף'}
                </Button>
                <Button type="button" className="ghost" onClick={handleCancelFeedback}>
                  ביטול
                </Button>
              </div>
            </form>
          </div>
        ) : (
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
                            style={{ width: '200px', height: '300px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
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
                   <div className="feedback-actions">
                     <Button 
                       className="ghost" 
                       onClick={() => handleEditFeedback(feedback, index)}
                     >
                       ערוך
                     </Button>
                     <Button 
                       className="ghost" 
                       onClick={() => handleDeleteFeedback(index)}
                       style={{ color: '#ef4444' }}
                     >
                       מחק
                     </Button>
                   </div>
                 </div>
               ))
            ) : (
              <p>אין משובים למוצר זה</p>
            )}
          </div>
        )}
      </div>
    );
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
            <label>תמונה:</label>
            <input
              name="image_file"
              type="file"
              accept="image/*"
              className="form-input"
            />
            {editingProduct?.image_url && (
              <div className="current-image">
                <p>תמונה נוכחית:</p>
                <img 
                  src={editingProduct.image_url} 
                  alt="תמונה נוכחית" 
                  style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                />
                <input
                  name="image_url"
                  type="hidden"
                  defaultValue={editingProduct.image_url}
                />
              </div>
            )}
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
                              <div className="product-price">₪{product.price.toFixed(2)}</div>
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
                onClick={() => handleShowFeedbacks(product)}
              >
                מה אנשים אומרים?
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
