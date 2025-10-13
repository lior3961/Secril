import express from 'express';
import { supabaseAdmin, supabaseForToken } from '../supabase.js';
import { requireAuthToken } from '../middleware/authToken.js';

const router = express.Router();

/**
 * Step 1: Create CardCom payment page
 * POST /api/payments/initiate
 * Body: { address, city, postal_code, products_arr, price }
 */
router.post('/initiate', requireAuthToken, async (req, res) => {
  try {
    const { address, city, postal_code, products_arr, price } = req.body;

    // Check CardCom configuration
    if (!process.env.CARDCOM_TERMINAL_NUMBER || !process.env.CARDCOM_API_NAME) {
      console.error('CardCom not configured. Missing environment variables.');
      return res.status(500).json({ 
        error: 'Payment system not configured. Please contact support.',
        details: 'CardCom credentials missing'
      });
    }

    // Validate required fields
    if (!price || !products_arr || !products_arr.products_ids || products_arr.products_ids.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user from token
    const s = supabaseForToken(req.jwt);
    const { data: userData, error: userError } = await s.auth.getUser();
    if (userError) return res.status(401).json({ error: userError.message });
    const user_id = userData.user.id;

    // Get user profile for contact information
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', user_id)
      .single();

    // Check stock availability before creating payment
    const productIds = [...new Set(products_arr.products_ids)];
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, quantity_in_stock')
      .in('id', productIds);

    if (productsError) {
      return res.status(400).json({ error: 'Failed to fetch products' });
    }

    // Count quantities for each product
    const productCounts = {};
    products_arr.products_ids.forEach(id => {
      productCounts[id] = (productCounts[id] || 0) + 1;
    });

    // Validate stock
    for (const product of products) {
      const orderedQuantity = productCounts[product.id] || 0;
      if (product.quantity_in_stock <= 0) {
        return res.status(400).json({ 
          error: `מוצר "${product.name}" אזל מהמלאי` 
        });
      }
      if (product.quantity_in_stock < orderedQuantity) {
        return res.status(400).json({ 
          error: `מוצר "${product.name}" - כמות מבוקשת (${orderedQuantity}) עולה על הכמות במלאי (${product.quantity_in_stock})` 
        });
      }
    }

    // Generate unique return value (order reference)
    const returnValue = `ORDER-${user_id.substring(0, 8)}-${Date.now()}`;

    // Prepare CardCom API request
    const cardcomRequest = {
      TerminalNumber: process.env.CARDCOM_TERMINAL_NUMBER,
      ApiName: process.env.CARDCOM_API_NAME,
      Amount: parseFloat(price),
      Operation: "ChargeOnly",
      ReturnValue: returnValue,
      ProductName: `הזמנה - ${products_arr.products_ids.length} פריטים`,
      Language: "he",
      ISOCoinId: 1, // Israeli Shekel
      SuccessRedirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-success`,
      FailedRedirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-failed`,
      WebHookUrl: process.env.CARDCOM_WEBHOOK_URL,
      UIDefinition: {
        CardOwnerNameValue: profile?.full_name || "",
        CardOwnerEmailValue: profile?.email || "",
        CardOwnerPhoneValue: profile?.phone || "",
        IsCardOwnerPhoneRequired: true,
        IsCardOwnerEmailRequired: true
      }
    };

    // Call CardCom API to create payment page
    let cardcomResponse;
    let cardcomData;
    
    try {
      cardcomResponse = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/Create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardcomRequest)
      });

      cardcomData = await cardcomResponse.json();
    } catch (fetchError) {
      console.error('CardCom API fetch error:', fetchError);
      return res.status(500).json({ 
        error: 'Failed to connect to payment service',
        details: fetchError.message
      });
    }

    if (cardcomData.ResponseCode !== 0) {
      console.error('CardCom API error:', cardcomData);
      return res.status(500).json({ 
        error: 'Failed to create payment page',
        details: cardcomData.Description,
        responseCode: cardcomData.ResponseCode
      });
    }

    // Store pending order in database
    const { data: pendingOrder, error: pendingError } = await supabaseAdmin
      .from('pending_orders')
      .insert({
        low_profile_id: cardcomData.LowProfileId,
        user_id,
        address: address || null,
        city: city || null,
        postal_code: postal_code || null,
        products_arr,
        price,
        payment_url: cardcomData.Url,
        cardcom_data: cardcomData,
        status: 'awaiting_payment'
      })
      .select()
      .single();

    if (pendingError) {
      console.error('Failed to create pending order:', pendingError);
      return res.status(500).json({ 
        error: 'Failed to create pending order',
        details: pendingError.message,
        hint: 'Make sure to run the database migration: backend/migrations/add_pending_orders.sql'
      });
    }

    // Return payment URL to frontend
    res.json({
      ok: true,
      paymentUrl: cardcomData.Url,
      lowProfileId: cardcomData.LowProfileId,
      pendingOrderId: pendingOrder.id
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Step 2: CardCom Webhook - receives payment notification
 * POST /api/payments/cardcom-webhook
 * This endpoint is called by CardCom servers after payment
 */
router.post('/cardcom-webhook', async (req, res) => {
  try {
    console.log('CardCom webhook received:', req.body);

    // CardCom expects HTTP 200 response
    // We process the payment asynchronously
    res.status(200).send('OK');

    // Process payment verification asynchronously
    processPaymentVerification(req.body).catch(err => {
      console.error('Async payment verification error:', err);
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Still return 200 to prevent retries
  }
});

/**
 * Process payment verification asynchronously
 */
async function processPaymentVerification(webhookData) {
  try {
    const { LowProfileId, ReturnValue } = webhookData;

    if (!LowProfileId) {
      console.error('Missing LowProfileId in webhook data');
      return;
    }

    // Step 3: Verify payment by calling CardCom API
    const verifyUrl = `https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult?` +
      `TerminalNumber=${process.env.CARDCOM_TERMINAL_NUMBER}&` +
      `ApiName=${process.env.CARDCOM_API_NAME}&` +
      `LowProfileId=${LowProfileId}`;

    const verifyResponse = await fetch(verifyUrl);
    const verificationData = await verifyResponse.json();

    console.log('Payment verification response:', verificationData);

    // Check if payment was successful
    if (verificationData.ResponseCode !== 0) {
      console.error('Payment failed:', verificationData.Description);
      
      // Update pending order status to failed
      await supabaseAdmin
        .from('pending_orders')
        .update({ 
          status: 'failed',
          cardcom_data: verificationData 
        })
        .eq('low_profile_id', LowProfileId);
      
      return;
    }

    // Get pending order
    const { data: pendingOrder, error: pendingError } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('low_profile_id', LowProfileId)
      .single();

    if (pendingError || !pendingOrder) {
      console.error('Pending order not found:', LowProfileId);
      return;
    }

    // Check if already processed
    if (pendingOrder.status === 'payment_verified') {
      console.log('Payment already processed for:', LowProfileId);
      return;
    }

    // Update stock quantities using admin client to bypass RLS
    const productIds = pendingOrder.products_arr.products_ids;
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, quantity_in_stock')
      .in('id', [...new Set(productIds)]);

    if (products) {
      const productCounts = {};
      productIds.forEach(id => {
        productCounts[id] = (productCounts[id] || 0) + 1;
      });

      for (const product of products) {
        const orderedQuantity = productCounts[product.id] || 0;
        const newStock = product.quantity_in_stock - orderedQuantity;
        
        console.log(`Updating product ${product.id}: ${product.quantity_in_stock} -> ${newStock}`);
        
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({ quantity_in_stock: newStock })
          .eq('id', product.id);

        if (updateError) {
          console.error('Stock update error:', updateError);
        }
      }
    }

    // Create the actual order
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: pendingOrder.user_id,
        address: pendingOrder.address,
        city: pendingOrder.city,
        postal_code: pendingOrder.postal_code,
        products_arr: pendingOrder.products_arr,
        price: pendingOrder.price,
        status: 'pending' // Order is created but not yet shipped
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create order:', orderError);
      console.error('Order error details:', {
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint
      });
      return;
    }

    console.log('Order created successfully:', newOrder?.id);

    // Update pending order status
    await supabaseAdmin
      .from('pending_orders')
      .update({ 
        status: 'payment_verified',
        cardcom_data: verificationData,
        updated_at: new Date().toISOString()
      })
      .eq('low_profile_id', LowProfileId);

    console.log('Order created successfully for LowProfileId:', LowProfileId);

  } catch (error) {
    console.error('Payment verification processing error:', error);
  }
}

/**
 * Get payment status
 * GET /api/payments/status/:lowProfileId
 */
router.get('/status/:lowProfileId', requireAuthToken, async (req, res) => {
  try {
    const { lowProfileId } = req.params;

    // Get user from token
    const s = supabaseForToken(req.jwt);
    const { data: userData, error: userError } = await s.auth.getUser();
    if (userError) return res.status(401).json({ error: userError.message });
    const user_id = userData.user.id;

    // Get pending order
    const { data: pendingOrder, error } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('low_profile_id', lowProfileId)
      .eq('user_id', user_id)
      .single();

    if (error || !pendingOrder) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      status: pendingOrder.status,
      lowProfileId: pendingOrder.low_profile_id,
      createdAt: pendingOrder.created_at,
      expiresAt: pendingOrder.expires_at
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify payment manually (for testing or retry)
 * POST /api/payments/verify/:lowProfileId
 */
router.post('/verify/:lowProfileId', requireAuthToken, async (req, res) => {
  try {
    const { lowProfileId } = req.params;

    // Get user from token
    const s = supabaseForToken(req.jwt);
    const { data: userData, error: userError } = await s.auth.getUser();
    if (userError) return res.status(401).json({ error: userError.message });
    const user_id = userData.user.id;

    // Get pending order
    const { data: pendingOrder } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('low_profile_id', lowProfileId)
      .eq('user_id', user_id)
      .single();

    if (!pendingOrder) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Trigger verification
    await processPaymentVerification({ LowProfileId: lowProfileId });

    // Get updated status
    const { data: updated } = await supabaseAdmin
      .from('pending_orders')
      .select('status')
      .eq('low_profile_id', lowProfileId)
      .single();

    res.json({
      ok: true,
      status: updated?.status || pendingOrder.status
    });

  } catch (error) {
    console.error('Manual verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

