-- BUG-002 fix: scope CHW stats by clinic/region for supervisor-safe aggregation.
CREATE OR REPLACE FUNCTION get_chw_case_stats(clinic_id uuid DEFAULT NULL, region_id uuid DEFAULT NULL)
RETURNS TABLE(
  chw_user_id uuid,
  total_cases bigint,
  urgent_cases bigint,
  emergency_cases bigint,
  last_case_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.chw_user_id,
    COUNT(*)                                          AS total_cases,
    COUNT(*) FILTER (WHERE c.risk_level = 'urgent')    AS urgent_cases,
    COUNT(*) FILTER (WHERE c.risk_level = 'emergency') AS emergency_cases,
    MAX(c.created_at)                                   AS last_case_at
  FROM cases c
  WHERE (
    (clinic_id IS NULL AND region_id IS NULL)
    OR (clinic_id IS NOT NULL AND c.clinic_id = clinic_id)
    OR (region_id IS NOT NULL AND c.region_id = region_id)
  )
  GROUP BY c.chw_user_id
  ORDER BY total_cases DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION get_chw_case_stats(uuid, uuid) TO service_role;
