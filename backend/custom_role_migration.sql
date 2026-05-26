-- Ensure the three-role model exists.
INSERT INTO roles (id, name, slug, description)
VALUES
  (gen_random_uuid(), 'Admin', 'ADMIN', 'System administrator'),
  (gen_random_uuid(), 'Manager', 'MANAGER', 'Operations manager'),
  (gen_random_uuid(), 'Operator', 'OPERATOR', 'Production operator')
ON CONFLICT (slug) DO NOTHING;
