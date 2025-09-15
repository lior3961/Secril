# Vercel Deployment Guide

This guide will help you deploy your full-stack React + Express application to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your Supabase project credentials
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Repository

1. Make sure all your code is committed and pushed to your Git repository
2. The project structure should be:
   ```
   my-supa-app/
   ├── frontend/          # React app
   ├── backend/           # Express API
   └── vercel.json        # Vercel configuration
   ```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Vercel will automatically detect the configuration from `vercel.json`

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. In your project root (`my-supa-app/`), run:
   ```bash
   vercel
   ```

3. Follow the prompts to link your project

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variables:

### Required Environment Variables:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE` | Your Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Frontend Environment Variables:

| Variable Name | Description | Value |
|---------------|-------------|-------|
| `VITE_API_URL` | Your Vercel API URL | `https://your-project.vercel.app/api` |

## Step 4: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the following values:
   - **Project URL** → Use as `SUPABASE_URL`
   - **anon public** key → Use as `SUPABASE_ANON_KEY`
   - **service_role** key → Use as `SUPABASE_SERVICE_ROLE`

## Step 5: Redeploy

After setting up environment variables:

1. Go to your Vercel dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click "Redeploy" on the latest deployment

## Step 6: Update Frontend API URL

Once deployed, update your frontend environment variable:

1. In Vercel dashboard, go to Environment Variables
2. Set `VITE_API_URL` to your actual Vercel URL: `https://your-project-name.vercel.app/api`
3. Redeploy the project

## Project Structure Explanation

The `vercel.json` configuration:

- **Frontend**: Built as a static site from the `frontend/` directory
- **Backend**: Deployed as serverless functions from the `backend/src/server.js`
- **Routes**: 
  - `/api/*` routes go to your Express backend
  - All other routes serve the React frontend

## Troubleshooting

### Common Issues:

1. **Environment Variables Not Working**
   - Make sure variables are set in Vercel dashboard
   - Redeploy after adding variables
   - Check variable names match exactly

2. **API Routes Not Working**
   - Verify your Express server exports the app correctly
   - Check that routes are properly configured in `vercel.json`

3. **Build Failures**
   - Check the build logs in Vercel dashboard
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility

### Checking Logs:

1. Go to Vercel dashboard
2. Click on your project
3. Go to "Functions" tab to see serverless function logs
4. Go to "Deployments" tab to see build logs

## Local Development

To test locally with Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# In your project root
vercel dev
```

This will run your app locally with Vercel's development environment.

## Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Discord](https://vercel.com/discord)
- [Supabase Documentation](https://supabase.com/docs)
