-- Update edge function URL to use Supabase Cloud instead of localhost

CREATE OR REPLACE FUNCTION get_edge_function_url(function_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use Supabase Cloud URL for production
  -- Format: https://<project-ref>.supabase.co/functions/v1/<function-name>
  RETURN 'https://hdkvgrpshgswdgsqihpp.supabase.co/functions/v1/' || function_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_edge_function_url(TEXT) IS 
  'Returns the URL for Supabase Edge Functions (Cloud deployment)';
