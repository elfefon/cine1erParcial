-- ==========================================
-- T9.2: CHECK CONSTRAINT PARA PUNTOS
-- ==========================================
ALTER TABLE profiles ADD CONSTRAINT puntos_positivos CHECK (puntos >= 0);
