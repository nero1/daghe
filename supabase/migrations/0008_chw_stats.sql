-- Helper function so supervisors and admins can see per-CHW aggregate case counts.
-- SECURITY DEFINER runs with function owner privileges, bypassing per-row RLS.
CREATE OR REPLACE FUNCTION get_chw_case_stats()
RETURNS TABLE(
  chw_user_id uuid,
  total_cases  bigint,
  urgent_cases  bigint,
  emergency_cases bigint,
  last_case_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    chw_user_id,
    COUNT(*)                                          AS total_cases,
    COUNT(*) FILTER (WHERE risk_level = 'urgent')    AS urgent_cases,
    COUNT(*) FILTER (WHERE risk_level = 'emergency') AS emergency_cases,
    MAX(created_at)                                   AS last_case_at
  FROM cases
  GROUP BY chw_user_id
  ORDER BY total_cases DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION get_chw_case_stats() TO service_role;
