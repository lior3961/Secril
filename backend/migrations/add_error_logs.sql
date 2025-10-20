-- Create error_logs table for application logging
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  level VARCHAR(20) NOT NULL, -- 'error', 'warn', 'info', 'debug'
  message TEXT NOT NULL,
  error_details JSONB,
  stack_trace TEXT,
  request_path VARCHAR(500),
  request_method VARCHAR(10),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  additional_context JSONB
);

-- Create indexes for common queries
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_level ON error_logs(level);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_request_path ON error_logs(request_path);

-- RLS policies for error_logs (admin only)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view error logs" ON error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create a function to clean up old logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Optional: Create a scheduled job to run cleanup weekly
-- Note: You'll need to enable pg_cron extension in Supabase dashboard
-- SELECT cron.schedule('cleanup-error-logs', '0 2 * * 0', 'SELECT cleanup_old_error_logs()');

COMMENT ON TABLE error_logs IS 'Application error and event logging for monitoring and debugging';

