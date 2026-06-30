UPDATE "scores"
SET
  "trust_status" = 'UNTRUSTED',
  "trust_reason" = 'Suspicious completion time before anti-cheat hardening',
  "reviewed_at" = NOW()
WHERE "id" IN (
  SELECT "id"
  FROM "scores"
  ORDER BY "time_ms" ASC, "created_at" ASC
  LIMIT 3
);
