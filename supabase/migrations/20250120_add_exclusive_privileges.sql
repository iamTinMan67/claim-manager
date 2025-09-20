-- Add exclusive privileges for application creator/developer
-- This bypasses all subscription checks and tier limitations

-- Add exclusive_privileges column to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN exclusive_privileges BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.subscribers.exclusive_privileges IS 'Grants exclusive access to application creator/developer, bypassing all subscription checks and tier limitations';

-- Create a function to check if user has exclusive privileges
CREATE OR REPLACE FUNCTION public.has_exclusive_privileges(user_id_param UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT exclusive_privileges 
     FROM public.subscribers 
     WHERE user_id = user_id_param), 
    false
  );
$function$;

-- Create a function to check if user has any valid access (exclusive OR subscribed)
CREATE OR REPLACE FUNCTION public.has_valid_access(user_id_param UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT exclusive_privileges OR subscribed 
     FROM public.subscribers 
     WHERE user_id = user_id_param), 
    false
  );
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_exclusive_privileges(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_access(UUID) TO authenticated;
