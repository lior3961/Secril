# CardCom Payment Integration - Quick Start

## ✅ What's Been Done

I've successfully integrated CardCom payment gateway into your e-commerce application. Here's what's been implemented:

### Backend Changes:
1. ✅ New payment routes in `/backend/src/routes/payments.js`
2. ✅ CardCom API integration (create payment page, verify payment)
3. ✅ Webhook endpoint to receive payment notifications
4. ✅ Pending orders system (orders are only created after successful payment)
5. ✅ Stock management (stock is only updated after successful payment)
6. ✅ Payment verification system (double-checks with CardCom servers)

### Frontend Changes:
1. ✅ React Router added for page navigation
2. ✅ Updated checkout flow to redirect to CardCom payment page
3. ✅ Success page (`/order-success`)
4. ✅ Failure page (`/order-failed`)
5. ✅ Payment status verification
6. ✅ CSS styling for payment result pages

### Database Changes:
1. ✅ New `pending_orders` table (migration in `/backend/migrations/add_pending_orders.sql`)
2. ✅ Automatic cleanup for expired pending orders

### Configuration:
1. ✅ Updated `vercel.json` (already configured for single Express function)
2. ✅ Updated `env.example` with CardCom variables
3. ✅ Added `react-router-dom` to frontend dependencies

## 🚀 Next Steps (What YOU Need to Do)

### 1. Run the Database Migration

Open Supabase SQL Editor and run:

```bash
# File: my-supa-app/backend/migrations/add_pending_orders.sql
```

Copy the entire SQL file and execute it in your Supabase project.

### 2. Get CardCom Credentials

Contact CardCom to get:
- Terminal Number
- API Name
- API Password

Start with a test/sandbox account first!

### 3. Configure Environment Variables

#### Local Development:

Create/update `backend/.env`:

```env
# Existing Supabase config...
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE=your_service_role

# Add CardCom (use test credentials first)
CARDCOM_TERMINAL_NUMBER=1000
CARDCOM_API_NAME=your_test_api_name
CARDCOM_API_PASSWORD=your_test_password
CARDCOM_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/payments/cardcom-webhook

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

#### Production (Vercel):

Go to Vercel Dashboard → Settings → Environment Variables and add:
- `CARDCOM_TERMINAL_NUMBER`
- `CARDCOM_API_NAME`
- `CARDCOM_API_PASSWORD`
- `CARDCOM_WEBHOOK_URL` = `https://your-domain.com/api/payments/cardcom-webhook`
- `FRONTEND_URL` = `https://your-domain.com`

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

This installs `react-router-dom`.

### 5. Test Locally (with ngrok for webhook)

```bash
# Terminal 1: Run backend
cd backend
npm run dev

# Terminal 2: Run frontend
cd frontend
npm run dev

# Terminal 3: Expose backend for webhook (port 4000 or your backend port)
ngrok http 4000
# Copy the ngrok URL and update CARDCOM_WEBHOOK_URL in .env
```

### 6. Test Payment Flow

1. Open http://localhost:5173
2. Add products to cart
3. Click "לתשלום"
4. Fill delivery details
5. Click "השלם הזמנה"
6. You'll be redirected to CardCom payment page
7. Use test card: `4580000000000000` (CVV: any 3 digits)
8. Complete payment
9. Verify you're redirected to success page
10. Check database - order should be created and stock updated

## 📋 Important Files

- **Payment Routes**: `backend/src/routes/payments.js`
- **Database Migration**: `backend/migrations/add_pending_orders.sql`
- **Success Page**: `frontend/src/components/OrderSuccess.jsx`
- **Failure Page**: `frontend/src/components/OrderFailed.jsx`
- **Updated Checkout**: `frontend/src/components/CartDrawer.jsx`
- **Full Documentation**: `CARDCOM_PAYMENT_INTEGRATION.md`

## ⚠️ Critical Points

1. **Webhook URL MUST be public** - Cannot be localhost
   - Use ngrok for local testing
   - Use your domain for production

2. **Always verify payments** - Don't trust webhook data alone
   - Backend always calls CardCom to verify
   - This prevents fraudulent orders

3. **Stock is checked twice**:
   - Before creating payment page
   - After payment (in webhook)
   - This prevents overselling

4. **Environment Variables** - Don't commit `.env` to git
   - Use `.env.example` as template
   - Set production vars in Vercel dashboard

5. **CardCom Dashboard** - Enable webhook notifications
   - Settings → Low Profile → "תמיד בצע דיווח של עסקה"

## 🔍 Testing Checklist

- [ ] Database migration applied successfully
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can add products to cart
- [ ] Payment page creation works
- [ ] Redirect to CardCom works
- [ ] Webhook receives payment notification
- [ ] Order created after payment
- [ ] Stock updated correctly
- [ ] Success page displays
- [ ] Failed payment shows error page

## 🐛 Troubleshooting

### "Failed to create payment page"
- Check CardCom credentials in `.env`
- Verify CardCom API is accessible
- Check backend logs for detailed error

### Webhook not being called
- Verify webhook URL is public (not localhost)
- Check CardCom dashboard webhook settings
- Check backend logs for incoming requests
- Test with https://webhook.site first

### Order not created after payment
- Check backend logs for errors
- Verify webhook received payment
- Check payment status: `GET /api/payments/status/:lowProfileId`
- Manually verify: `POST /api/payments/verify/:lowProfileId`

### Stock not updating
- Check `SUPABASE_SERVICE_ROLE` is set
- Verify RLS policies allow updates
- Check backend logs for update errors

## 📞 Need Help?

1. Read full documentation: `CARDCOM_PAYMENT_INTEGRATION.md`
2. Check CardCom API docs: https://secure.cardcom.solutions/api/docs
3. Contact CardCom support for API issues
4. Check backend logs for errors
5. Monitor CardCom dashboard for webhook logs

## 🎉 You're Almost Done!

Just complete the 6 steps above and you'll have a fully functional payment system!

The hard work is done - I've built the entire integration. You just need to:
1. Run the SQL migration
2. Get CardCom credentials
3. Set environment variables
4. Test it

Good luck! 🚀

