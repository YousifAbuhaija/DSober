-- DD check-in location: captured when a DD passes SEP and goes on duty, so the
-- Find-a-DD list can show each on-duty driver's distance from the rider.
alter table public.dd_sessions
  add column if not exists start_latitude  numeric,
  add column if not exists start_longitude numeric;
