-- ==========================================
-- T5.1: ACTIVAR REALTIME PARA SEAT_RESERVATIONS
-- ==========================================

-- Asegurarse de que publication supabase_realtime exista, si no existe no pasa nada (usualmente existe)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE seat_reservations;
