# Database Connection Guide for Vercel Deployment

This guide will help you connect your Supabase database to your Vercel deployment.

## Overview

Your application uses **Supabase** as the database, which is a PostgreSQL-based backend-as-a-service. The connection is already configured in your code, but you need to set up the environment variables in Vercel.

## Current Database Configuration

Your backend is already configured to connect to Supabase in `backend/src/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE;

// Regular client (RLS enforced unless a JWT is provided)
export const supabase = createClient(url, anon);

// Admin client (bypasses RLS) — only on the server
export const supabaseAdmin = createClient(url, service);
```

## Step 1: Get Your Supabase Credentials

### If you already have a Supabase project:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following values:

| Credential | Where to Find | Used For |
|------------|---------------|----------|
| **Project URL** | Settings → API → Project URL | `SUPABASE_URL` |
| **anon public** | Settings → API → Project API keys → anon public | `SUPABASE_ANON_KEY` |
| **service_role** | Settings → API → Project API keys → service_role | `SUPABASE_SERVICE_ROLE` |

### If you need to create a new Supabase project:

1. Go to [Supabase](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `secril-app` (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for the project to be set up (2-3 minutes)

## Step 2: Set Up Your Database Schema

Your application likely needs these tables. Run these SQL commands in your Supabase SQL Editor:

### 1. Users Table (extends Supabase auth.users)
```sql
-- Create profiles table that extends auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  date_of_birth DATE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 2. Products Table
```sql
-- Create products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  category TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies (products are publicly readable)
CREATE POLICY "Products are viewable by everyone" ON products
  FOR SELECT USING (is_active = true);

-- Only admins can modify products (you'll need to implement admin role)
CREATE POLICY "Only admins can modify products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );
```

### 3. Orders Table
```sql
-- Create orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  shipping_address JSONB NOT NULL,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4. Order Items Table
```sql
-- Create order_items table
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view order items for their orders" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );
```

### 5. Contact Messages Table
```sql
-- Create contact_messages table
CREATE TABLE contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Create policies (only admins can read, anyone can create)
CREATE POLICY "Anyone can create contact messages" ON contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can read contact messages" ON contact_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );
```

### 6. Add Admin Role to Profiles
```sql
-- Add role column to profiles
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, date_of_birth, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'date_of_birth')::date,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Step 3: Configure Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

### Required Environment Variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Your Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Your Supabase service role key |

### Frontend Environment Variable:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `VITE_API_URL` | `https://your-project.vercel.app/api` | Your Vercel API URL |

## Step 4: Test Database Connection

After setting up environment variables:

1. **Redeploy your project** in Vercel
2. **Test the connection** by:
   - Going to your deployed app
   - Trying to sign up/login
   - Creating a product (if you have admin access)
   - Placing an order

## Step 5: Verify Database Connection

### Check Vercel Function Logs:

1. Go to Vercel Dashboard → Your Project → Functions
2. Look for any error logs related to database connection
3. Common errors and solutions:

| Error | Solution |
|-------|----------|
| `Invalid API key` | Check your `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE` |
| `Invalid URL` | Verify your `SUPABASE_URL` is correct |
| `RLS policy violation` | Check your Row Level Security policies |
| `Table doesn't exist` | Run the SQL schema creation commands |

### Test API Endpoints:

You can test your API endpoints directly:

```bash
# Test health endpoint (if you have one)
curl https://your-project.vercel.app/api/health

# Test products endpoint
curl https://your-project.vercel.app/api/products
```

## Step 6: Production Considerations

### Security:

1. **Never expose service role key** in frontend code
2. **Use RLS policies** to secure your data
3. **Validate all inputs** on the backend
4. **Use HTTPS** (Vercel provides this automatically)

### Performance:

1. **Add database indexes** for frequently queried columns:
```sql
-- Add indexes for better performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

2. **Monitor your database** in Supabase dashboard
3. **Set up connection pooling** if needed

## Troubleshooting

### Common Issues:

1. **"Invalid API key" errors**:
   - Double-check your environment variables in Vercel
   - Make sure you copied the keys correctly
   - Redeploy after adding environment variables

2. **"Table doesn't exist" errors**:
   - Run the SQL schema creation commands in Supabase SQL Editor
   - Check that your table names match your code

3. **"RLS policy violation" errors**:
   - Review your Row Level Security policies
   - Make sure users have the right permissions
   - Test with different user roles

4. **Connection timeouts**:
   - Check your Supabase project status
   - Verify your region selection
   - Consider upgrading your Supabase plan if needed

### Getting Help:

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Vercel Documentation](https://vercel.com/docs)

## Next Steps

After successfully connecting your database:

1. **Add sample data** to test your application
2. **Set up monitoring** and alerts
3. **Configure backups** in Supabase
4. **Set up staging environment** for testing
5. **Implement proper error handling** and logging
