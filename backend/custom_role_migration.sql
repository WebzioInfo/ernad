-- 1. Ensure the generic OPERATOR role exists
INSERT INTO roles (id, name, slug, description)
VALUES (gen_random_uuid(), 'Operator', 'OPERATOR', 'Generic production operator')
ON CONFLICT (slug) DO NOTHING;

-- 2. Map legacy operator roles to the generic OPERATOR role
WITH operator_role AS (
    SELECT id FROM roles WHERE slug = 'OPERATOR' LIMIT 1
),
legacy_roles AS (
    SELECT id FROM roles WHERE slug IN (
        'OPERATOR_BLOWING', 
        'OPERATOR_FILLING', 
        'OPERATOR_LABELING', 
        'OPERATOR_PACKING',
        'SUPERVISOR' -- Supervisor is also being removed from core roles
    )
)
-- Insert the generic operator role for users who had legacy roles (if they don't already have it)
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, (SELECT id FROM operator_role)
FROM user_roles ur
WHERE ur.role_id IN (SELECT id FROM legacy_roles)
ON CONFLICT DO NOTHING;

-- 3. Delete legacy role assignments
DELETE FROM user_roles 
WHERE role_id IN (
    SELECT id FROM roles WHERE slug IN (
        'OPERATOR_BLOWING', 
        'OPERATOR_FILLING', 
        'OPERATOR_LABELING', 
        'OPERATOR_PACKING',
        'SUPERVISOR'
    )
);

-- 4. Delete the legacy roles themselves
DELETE FROM roles 
WHERE slug IN (
    'OPERATOR_BLOWING', 
    'OPERATOR_FILLING', 
    'OPERATOR_LABELING', 
    'OPERATOR_PACKING',
    'SUPERVISOR'
);

-- 5. Drop currentOperatorId and currentSessionId from production_lines
ALTER TABLE production_lines DROP COLUMN IF EXISTS current_operator_id;
ALTER TABLE production_lines DROP COLUMN IF EXISTS current_session_id;
ALTER TABLE production_lines DROP COLUMN IF EXISTS session_started_at;
