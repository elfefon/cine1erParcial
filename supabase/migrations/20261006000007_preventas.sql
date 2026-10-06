-- ==========================================
-- T7.2: PREVENTAS EN SHOWTIMES
-- ==========================================
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS es_preventa BOOLEAN DEFAULT false;
