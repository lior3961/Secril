# CardCom Payment Integration Guide

## Overview

This application now integrates with CardCom payment gateway. When customers complete their orders, they are redirected to a secure CardCom payment page. Orders are only created and stock is only updated after successful payment.

## Payment Flow

1. **Customer Checkout**: Customer fills out delivery details and clicks "לתשלום" (To Payment)
2. **Payment Page Creation**: Backend creates a CardCom payment page and saves order details as "pending"
3. **Redirect to Payment**: Customer is redirected to CardCom's secure payment page
4. **Payment Processing**: Customer enters credit card details and completes payment
5. **Webhook Notification**: CardCom sends payment result to our webhook
6. **Verification**: Backend verifies payment with CardCom servers
7. **Order Creation**: If payment successful, order is created and stock is updated
8. **Customer Redirect**: Customer is redirected to success/failure page

## Setup Instructions

### 1. Database Setup

Run the migration to create the `pending_orders` table:

```sql
-- Run this in your Supabase SQL Editor
-- File: backend/migrations/add_pending_orders.sql
```

Open your Supabase project → SQL Editor → paste and run the migration file.

### 2. Get CardCom Credentials

1. Contact CardCom support to get:
   - `CARDCOM_TERMINAL_NUMBER` - Your terminal number
   - `CARDCOM_API_NAME` - Your API username
   - `CARDCOM_API_PASSWORD` - Your API password

2. Set up a test/sandbox account first before going live

### 3. Configure Environment Variables

#### Backend (.env file in `/backend` folder):

```env
# Existing variables...
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE=your_service_role_key

# CardCom Configuration (ADD THESE)
CARDCOM_TERMINAL_NUMBER=1000
CARDCOM_API_NAME=your_api_name
CARDCOM_API_PASSWORD=your_api_password
CARDCOM_WEBHOOK_URL=https://your-domain.com/api/payments/cardcom-webhook

# Frontend URL (for redirects)
FRONTEND_URL=https://your-domain.com
```

**Important**: 
- For development: `FRONTEND_URL=http://localhost:5173`
- For production: `FRONTEND_URL=https://your-production-domain.com`
- Webhook URL must be **publicly accessible** (not localhost)

### 4. Configure CardCom Dashboard

Log in to your CardCom dashboard and:

1. Go to Settings → Low Profile Settings
2. Enable "Always send webhook notification" (תמיד בצע דיווח של עסקה)
3. Verify your webhook URL is whitelisted
4. Set default success/failure URLs (optional, we send them in each request)

### 5. Install Dependencies

#### Frontend:
```bash
cd frontend
npm install
```

This will install the new `react-router-dom` dependency.

#### Backend:
No new dependencies needed, everything is already installed.

### 6. Test Webhook Locally (Development)

Since CardCom needs a public webhook URL, use **ngrok** or **localtunnel** for local testing:

```bash
# Install ngrok: https://ngrok.com/download

# Run your backend
cd backend
npm run dev

# In another terminal, expose port 4000 (or your backend port)
ngrok http 4000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and use it in your `.env`:

```env
CARDCOM_WEBHOOK_URL=https://abc123.ngrok.io/api/payments/cardcom-webhook
```

### 7. Test Payment Flow

#### Test Credentials:
CardCom provides test credit cards for sandbox testing:

- **Card Number**: `4580000000000000`
- **CVV**: Any 3 digits
- **Expiry**: Any future date

#### Testing Steps:

1. Add products to cart
2. Click "לתשלום" (To Payment)
3. Fill delivery details
4. Click "השלם הזמנה" (Complete Order)
5. You'll be redirected to CardCom payment page
6. Enter test credit card details
7. Complete payment
8. You'll be redirected back to success page
9. Verify order was created in database
10. Verify stock was updated

### 8. Verify Integration

Check these endpoints:

```bash
# Health check (should show cardcomConfigured: true)
curl https://your-domain.com/api/health

# Test payment initiation (requires authentication)
curl -X POST https://your-domain.com/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "address": "Test St 123",
    "city": "Tel Aviv",
    "postal_code": "12345",
    "products_arr": {"products_ids": ["product-uuid-1"]},
    "price": 100
  }'
```

## API Endpoints

### Payment Endpoints

#### POST `/api/payments/initiate`
Creates CardCom payment page and pending order.

**Request:**
```json
{
  "address": "Street 123",
  "city": "Tel Aviv",
  "postal_code": "12345",
  "products_arr": {
    "products_ids": ["uuid1", "uuid2"]
  },
  "price": 250.50
}
```

**Response:**
```json
{
  "ok": true,
  "paymentUrl": "https://secure.cardcom.solutions/...",
  "lowProfileId": "aa-bb-cc",
  "pendingOrderId": "uuid"
}
```

#### POST `/api/payments/cardcom-webhook`
Receives payment notifications from CardCom (called automatically by CardCom).

#### GET `/api/payments/status/:lowProfileId`
Check payment status.

**Response:**
```json
{
  "status": "payment_verified",
  "lowProfileId": "aa-bb-cc",
  "createdAt": "2025-01-01T12:00:00Z",
  "expiresAt": "2025-01-01T12:30:00Z"
}
```

#### POST `/api/payments/verify/:lowProfileId`
Manually trigger payment verification (for testing or retry).

## Production Deployment

### Vercel Configuration

Your `vercel.json` is already configured correctly to deploy as a single Express function.

#### Environment Variables in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all CardCom variables:
   - `CARDCOM_TERMINAL_NUMBER`
   - `CARDCOM_API_NAME`
   - `CARDCOM_API_PASSWORD`
   - `CARDCOM_WEBHOOK_URL` (use your production URL)
   - `FRONTEND_URL` (your production frontend URL)

3. Redeploy after adding variables

### Important Production Notes

1. **Webhook URL**: Must be your production URL (e.g., `https://your-domain.com/api/payments/cardcom-webhook`)
2. **HTTPS Required**: CardCom requires HTTPS for webhooks
3. **No Localhost**: Webhook URL cannot be localhost or 127.0.0.1
4. **Firewall**: Ensure your server accepts requests from CardCom IPs
5. **Logs**: Monitor CardCom webhook calls in your backend logs

## Security Considerations

1. **Always Verify**: Never trust webhook data alone - always verify with CardCom servers
2. **Stock Check**: Stock is verified before payment initiation
3. **Idempotency**: Webhook can be called multiple times - we handle this
4. **Session Storage**: Payment ID stored in browser session for verification
5. **RLS Policies**: Supabase RLS ensures users can only see their own orders

## Troubleshooting

### Webhook not receiving calls

1. Check CardCom dashboard logs: "דוח פעילות פרופיל נמוך"
2. Verify webhook URL is publicly accessible
3. Check backend logs for incoming requests
4. Ensure webhook returns HTTP 200

### Payment successful but order not created

1. Check backend logs for errors
2. Verify database RLS policies
3. Check stock availability
4. Manually trigger verification: `POST /api/payments/verify/:lowProfileId`

### Stock not updating

1. Check `SUPABASE_SERVICE_ROLE` is set correctly
2. Verify admin client has permission to update products
3. Check backend logs for stock update errors

### Customer stuck on payment page

1. Pending orders expire after 30 minutes
2. Run cleanup: `SELECT cleanup_expired_pending_orders();`
3. Customer can restart checkout process

## Monitoring

Monitor these in production:

1. **Failed Payments**: Check `pending_orders` table for status = 'failed'
2. **Expired Orders**: Run periodic cleanup
3. **Stock Levels**: Monitor low stock products
4. **Webhook Logs**: Check for missed webhooks
5. **Payment Verification**: Monitor success rate

## Optional Enhancements

Future improvements you can add:

1. **Email Notifications**: Send order confirmations
2. **SMS Updates**: Integrate with CardCom SMS module
3. **Invoice Generation**: Use CardCom document generation
4. **Recurring Payments**: Use CardCom tokens for subscriptions
5. **Refunds**: Implement refund API
6. **Analytics**: Track conversion rates

## Support

- **CardCom Support**: support@cardcom.solutions
- **Documentation**: https://secure.cardcom.solutions/api/docs

## Testing Checklist

- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Webhook URL is publicly accessible
- [ ] Test payment completes successfully
- [ ] Order created after payment
- [ ] Stock updated correctly
- [ ] Success page shows correct message
- [ ] Failed payment shows error page
- [ ] Webhook logs showing in dashboard
- [ ] Payment verification working
- [ ] Production credentials obtained
- [ ] Production environment variables set
- [ ] Production deployment tested

## Version History

- **v1.0.0** (2025-01-09): Initial CardCom integration
  - Payment page redirect
  - Webhook handling
  - Order creation after payment
  - Stock management
  - Success/failure pages

