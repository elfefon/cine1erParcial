-- ==========================================
-- T4.2: ACTUALIZACION TABLA DE CUPONES
-- ==========================================
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS limite_usos INTEGER DEFAULT NULL;
