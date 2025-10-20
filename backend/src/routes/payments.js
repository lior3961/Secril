import express from 'express';
import { supabaseAdmin, supabaseForToken } from '../supabase.js';
import { requireAuthToken } from '../middleware/authToken.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

/**
 * Step 1: Create CardCom payment page
 * POST /api/payments/initiate
 * Body: { address, city, postal_code, products_arr, price }
 */
router.post('/initiate', requireAuthToken, async (req, res) => {
  try {
    console.log('Payment initiation started:', { 
      hasBody: !!req.body, 
      price: req.body?.price,
      productsCount: req.body?.products_arr?.products_ids?.length 
    });
    
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
      console.error('Missing required fields:', { price, products_arr });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user from token
    console.log('Getting user from token...');
    const s = supabaseForToken(req.jwt);
    const { data: userData, error: userError } = await s.auth.getUser();
    if (userError) {
      console.error('User auth error:', userError);
      return res.status(401).json({ error: userError.message });
    }
    const user_id = userData.user.id;
    console.log('User authenticated:', user_id.substring(0, 8));

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
      if (product.quantity_in_stock < 0) {
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
    console.log('Calling CardCom API...');
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
      console.log('CardCom API response:', { 
        ResponseCode: cardcomData.ResponseCode, 
        Description: cardcomData.Description,
        hasUrl: !!cardcomData.Url 
      });
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
    console.log('Creating pending order in database...');
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

    console.log('Pending order created successfully:', pendingOrder.id);

    // Return payment URL to frontend
    console.log('Returning payment URL to frontend');
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
    console.log('Webhook headers:', req.headers);

    // CardCom expects HTTP 200 response with JSON
    res.status(200).json({ received: true, status: 'ok' });

    // Process payment verification asynchronously
    processPaymentVerification(req.body).catch(err => {
      console.error('Async payment verification error:', err);
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ received: true, status: 'error', error: error.message }); // Still return 200 to prevent retries
  }
});

// In-memory lock to prevent concurrent processing of same payment
// Auto-cleanup after 30 seconds to prevent memory leaks on Vercel free plan
const processingLocks = new Map();

// Cleanup function to remove old locks (prevents memory leaks)
function cleanupOldLocks() {
  const now = Date.now();
  for (const [key, value] of processingLocks.entries()) {
    if (value.timestamp && now - value.timestamp > 30000) { // 30 seconds
      processingLocks.delete(key);
    }
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupOldLocks, 60000);

/**
 * Process payment verification asynchronously with idempotency
 */
async function processPaymentVerification(webhookData) {
  const { LowProfileId, ReturnValue } = webhookData;

  if (!LowProfileId) {
    logger.error('Missing LowProfileId in webhook data', null, null, webhookData);
    return;
  }

  // Prevent concurrent processing of the same payment
  if (processingLocks.has(LowProfileId)) {
    logger.warn(`Payment verification already in progress for ${LowProfileId}`, null, { LowProfileId });
    return;
  }

  processingLocks.set(LowProfileId, { timestamp: Date.now() });

  try {
    logger.info(`Starting payment verification for LowProfileId: ${LowProfileId}`, null, { LowProfileId });

    // STEP 1: Get pending order and check status atomically
    const { data: pendingOrder, error: pendingError } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('low_profile_id', LowProfileId)
      .single();

    if (pendingError || !pendingOrder) {
      logger.error('Pending order not found', pendingError, null, { LowProfileId });
      return;
    }

    // IDEMPOTENCY CHECK: If already processed, skip
    if (pendingOrder.status === 'payment_verified' || pendingOrder.status === 'completed') {
      logger.warn(`Payment already processed for ${LowProfileId}`, null, { 
        LowProfileId, 
        currentStatus: pendingOrder.status 
      });
      return;
    }

    // STEP 2: Mark as processing to prevent duplicate webhook calls
    const { error: lockError } = await supabaseAdmin
      .from('pending_orders')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('low_profile_id', LowProfileId)
      .eq('status', 'awaiting_payment'); // Only update if still awaiting

    // If update failed, another process is handling it
    if (lockError) {
      logger.warn(`Failed to lock payment for processing: ${LowProfileId}`, null, { 
        LowProfileId, 
        error: lockError 
      });
      return;
    }

    // STEP 3: Verify payment with CardCom API
    logger.info(`Verifying payment with CardCom for ${LowProfileId}`, null, { LowProfileId });
    
    const verifyRequest = {
      TerminalNumber: process.env.CARDCOM_TERMINAL_NUMBER,
      ApiName: process.env.CARDCOM_API_NAME,
      LowProfileId: LowProfileId
    };

    const verifyResponse = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyRequest)
    });
    
    const verificationData = await verifyResponse.json();
    logger.info(`CardCom verification response: ${verificationData.ResponseCode}`, null, { 
      LowProfileId, 
      responseCode: verificationData.ResponseCode 
    });

    // STEP 4: Check if payment was successful
    if (verificationData.ResponseCode !== 0) {
      logger.error(`Payment failed for ${LowProfileId}`, null, null, { 
        LowProfileId, 
        responseCode: verificationData.ResponseCode,
        description: verificationData.Description 
      });
      
      // Update pending order status to failed
      await supabaseAdmin
        .from('pending_orders')
        .update({ 
          status: 'failed',
          cardcom_data: verificationData,
          updated_at: new Date().toISOString()
        })
        .eq('low_profile_id', LowProfileId);
      
      return;
    }

    // STEP 5: Update stock quantities with better error handling
    const productIds = pendingOrder.products_arr.products_ids;
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, quantity_in_stock')
      .in('id', [...new Set(productIds)]);

    if (productsError) {
      logger.error('Failed to fetch products for stock update', productsError, null, { LowProfileId });
      // Rollback: Set status back to awaiting_payment
      await supabaseAdmin
        .from('pending_orders')
        .update({ 
          status: 'awaiting_payment',
          updated_at: new Date().toISOString()
        })
        .eq('low_profile_id', LowProfileId);
      return;
    }

    if (products && products.length > 0) {
      const productCounts = {};
      productIds.forEach(id => {
        productCounts[id] = (productCounts[id] || 0) + 1;
      });

      // Update each product's stock
      for (const product of products) {
        const orderedQuantity = productCounts[product.id] || 0;
        const newStock = Math.max(0, product.quantity_in_stock - orderedQuantity);
        
        logger.info(`Updating stock for product ${product.id} (${product.name}): ${product.quantity_in_stock} -> ${newStock}`);
        
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({ quantity_in_stock: newStock })
          .eq('id', product.id);

        if (updateError) {
          logger.error(`Stock update error for product ${product.id}`, updateError, null, { 
            LowProfileId, 
            productId: product.id,
            productName: product.name 
          });
          // Continue with other products even if one fails
        }
      }
    }

    // STEP 6: Create the actual order
    logger.info(`Creating final order for ${LowProfileId}`, null, { LowProfileId });
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
      logger.error('Failed to create order', orderError, null, {
        LowProfileId,
        errorMessage: orderError.message,
        errorDetails: orderError.details,
        errorHint: orderError.hint
      });
      
      // Mark as failed so admin can investigate
      await supabaseAdmin
        .from('pending_orders')
        .update({ 
          status: 'failed',
          cardcom_data: { 
            ...verificationData, 
            orderError: orderError.message 
          },
          updated_at: new Date().toISOString()
        })
        .eq('low_profile_id', LowProfileId);
      
      return;
    }

    logger.info(`Order created successfully: ${newOrder?.id}`, null, { 
      LowProfileId, 
      orderId: newOrder?.id 
    });

    // STEP 7: Update pending order status to completed
    await supabaseAdmin
      .from('pending_orders')
      .update({ 
        status: 'payment_verified',
        cardcom_data: verificationData,
        updated_at: new Date().toISOString()
      })
      .eq('low_profile_id', LowProfileId);

    logger.info(`Payment verification completed for ${LowProfileId}`, null, { 
      LowProfileId,
      orderId: newOrder?.id 
    }); // Success doesn't need DB logging (only errors)

  } catch (error) {
    logger.error('Payment verification processing error', error, null, { LowProfileId });
    
    // Try to rollback the status
    try {
      await supabaseAdmin
        .from('pending_orders')
        .update({ 
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('low_profile_id', LowProfileId);
    } catch (rollbackError) {
      logger.error('Failed to update status after error', rollbackError, null, { LowProfileId });
    }
  } finally {
    // Always release the lock
    processingLocks.delete(LowProfileId);
  }
}

/**
 * Test webhook endpoint (for debugging)
 * GET /api/payments/test-webhook
 */
router.get('/test-webhook', (req, res) => {
  res.json({
    message: 'Webhook endpoint is working',
    webhookUrl: process.env.CARDCOM_WEBHOOK_URL,
    hasWebhookUrl: !!process.env.CARDCOM_WEBHOOK_URL
  });
});

/**
 * Test webhook POST endpoint (for debugging)
 * POST /api/payments/test-webhook
 */
router.post('/test-webhook', (req, res) => {
  console.log('Test webhook POST received:', req.body);
  res.json({ 
    message: 'Test webhook POST endpoint is working',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

/**
 * Manual webhook trigger (for debugging)
 * POST /api/payments/manual-webhook/:lowProfileId
 */
router.post('/manual-webhook/:lowProfileId', async (req, res) => {
  try {
    const { lowProfileId } = req.params;
    console.log('Manual webhook trigger for:', lowProfileId);
    
    // Simulate webhook data
    const webhookData = {
      LowProfileId: lowProfileId,
      ReturnValue: `ORDER-${lowProfileId}`
    };
    
    // Process the verification
    await processPaymentVerification(webhookData);
    
    res.json({ 
      ok: true, 
      message: 'Manual webhook processing triggered',
      lowProfileId 
    });
  } catch (error) {
    console.error('Manual webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

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

