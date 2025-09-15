# API Debugging Guide - 404 Error Fix

## Problem
Your frontend is getting a 404 error when trying to access `https://secril.me/api/products`.

## Root Cause
The issue is likely with how Vercel is handling your Express.js backend as a serverless function.

## ✅ Fixes Applied

### 1. Updated `backend/src/server.js`
- Added proper export for Vercel: `export default app;`
- Added conditional server startup (only for local development)

### 2. Updated `vercel.json`
- Added function configuration with `maxDuration: 30`
- Ensured proper routing configuration

### 3. Updated CORS Configuration
- Added `https://secril.me` to allowed origins

### 4. Created Test API Endpoint
- Added `api/test.js` for debugging

## 🔧 Steps to Fix

### Step 1: Commit and Push Changes
```bash
git add .
git commit -m "Fix API routing for Vercel deployment"
git push
```

### Step 2: Redeploy on Vercel
1. Go to your Vercel dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click "Redeploy" on the latest deployment

### Step 3: Test API Endpoints

#### Test 1: Simple API Test
Visit: `https://secril.me/api/test`
Expected: `{"message": "API is working!", ...}`

#### Test 2: Health Check
Visit: `https://secril.me/api/health`
Expected: `{"ok": true, "urlSet": true, "hasServiceRole": true}`

#### Test 3: Products Endpoint
Visit: `https://secril.me/api/products`
Expected: Array of products or empty array

### Step 4: Check Vercel Function Logs
1. Go to Vercel Dashboard → Your Project → Functions
2. Look for any error logs
3. Check if the function is being invoked

## 🐛 Alternative Solutions

### Option 1: Use Vercel's API Routes Structure
If the current approach doesn't work, we can restructure to use Vercel's native API routes:

1. Move your API logic to `api/` directory
2. Each route becomes a separate file
3. Update `vercel.json` to remove the backend build

### Option 2: Check Environment Variables
Make sure these are set in Vercel:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`

### Option 3: Debug with Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Test locally
vercel dev
```

## 🔍 Debugging Commands

### Check if API is accessible:
```bash
curl https://secril.me/api/test
curl https://secril.me/api/health
curl https://secril.me/api/products
```

### Check Vercel function logs:
```bash
vercel logs https://secril.me
```

## 📋 Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| 404 on all API routes | Check `vercel.json` routing configuration |
| CORS errors | Verify CORS configuration in server.js |
| Environment variables not working | Check Vercel dashboard environment variables |
| Function timeout | Increase `maxDuration` in vercel.json |
| Build failures | Check Vercel build logs |

## 🚀 Expected Results After Fix

1. **API Test**: `https://secril.me/api/test` should return success message
2. **Health Check**: `https://secril.me/api/health` should return status
3. **Products**: `https://secril.me/api/products` should return products array
4. **Frontend**: Your React app should successfully fetch products

## 📞 Next Steps

1. **Deploy the changes** (commit, push, redeploy)
2. **Test the endpoints** using the URLs above
3. **Check Vercel logs** if issues persist
4. **Let me know the results** so I can help further if needed

## 🔧 If Still Not Working

If you're still getting 404 errors after these changes, we may need to:

1. **Restructure to Vercel API routes** (move from Express to individual API files)
2. **Check your domain configuration** in Vercel
3. **Verify your deployment settings**

The changes I made should resolve the 404 issue. The key was properly exporting the Express app for Vercel's serverless environment.
