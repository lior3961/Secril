import 'dotenv/config';
import { supabaseAdmin } from './src/supabase.js';

async function updateProductImage() {
  try {
    console.log('Updating product ID 1 with image...');
    
    // Get the public URL for the image
    const { data: urlData } = supabaseAdmin.storage
      .from('products_images')
      .getPublicUrl('secril1.png');

    const imageUrl = urlData.publicUrl;
    console.log('Image URL:', imageUrl);

    // Update the product with the image URL
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', 1)
      .select();

    if (error) {
      console.error('Error updating product:', error);
      return;
    }

    console.log('Successfully updated product:', data[0]);
    console.log('Product now has image URL:', data[0].image_url);
    
  } catch (err) {
    console.error('Failed to update product:', err);
  }
}

// Run the script
updateProductImage();
