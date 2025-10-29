# Payment Debugging Guide

## Problem
Getting "סטטוס לא ידוע" (Status Unknown) error after payment, with 400 errors in logs.

## ✅ Fixes Applied

### 1. Enhanced Error Handling
- Added CardCom configuration check before verification
- Added HTTP response status check for CardCom API calls
- Better error logging and status updates

### 2. Debug Endpoints Added
- `GET /api/payments/test-webhook` - Check if webhook endpoint is working
- `GET /api/payments/debug/:lowProfileId` - Debug specific payment status

## 🔍 Debugging Steps

### Step 1: Check Payment Status
Use the debug endpoint to see what's happening:
```bash
curl "https://your-domain.vercel.app/api/payments/debug/YOUR_LOW_PROFILE_ID"
```

### Step 2: Check Webhook Endpoint
```bash
curl "https://your-domain.vercel.app/api/payments/test-webhook"
```

### Step 3: Check Vercel Logs
Look for these specific error patterns:
- `CardCom not configured for verification`
- `CardCom API error: [status]`
- `Failed to lock payment for processing`
- `Payment verification processing error`

## 🚀 Deploy the Fixes

```bash
git add .
git commit -m "Add payment verification debugging and error handling"
git push
```

## 🔧 Common Issues and Solutions

### Issue 1: CardCom Not Configured
**Symptoms:** `CardCom not configured for verification`
**Solution:** Check environment variables in Vercel:
- `CARDCOM_TERMINAL_NUMBER`
- `CARDCOM_API_NAME`

### Issue 2: CardCom API Error
**Symptoms:** `CardCom API error: [status]`
**Solution:** Check CardCom API status and credentials

### Issue 3: Payment Lock Failed
**Symptoms:** `Failed to lock payment for processing`
**Solution:** This is usually temporary - payment is being processed by another instance

### Issue 4: Missing Pending Order
**Symptoms:** `Pending order not found`
**Solution:** Check if the pending order was created during payment initiation

## 📊 Expected Status Flow

1. **`awaiting_payment`** - Payment page created
2. **`processing`** - Payment received, being verified
3. **`payment_verified`** - Payment successful, order created
4. **`failed`** - Payment failed or verification error
5. **`expired`** - Payment expired (after 30 minutes)

## 🧪 Testing

### Test Payment Flow:
1. Make a test purchase
2. Check debug endpoint: `/api/payments/debug/[lowProfileId]`
3. Monitor Vercel logs for errors
4. Check if order is created in database

### Test Manual Verification:
```bash
curl -X POST "https://your-domain.vercel.app/api/payments/verify/[lowProfileId]" \
  -H "Authorization: Bearer [your-token]"
```

## 📋 Next Steps

1. **Deploy the fixes** (git push)
2. **Test a payment** and check debug endpoint
3. **Monitor logs** for any remaining errors
4. **Check CardCom configuration** if issues persist

The enhanced error handling should provide much clearer information about what's failing in the payment verification process.
