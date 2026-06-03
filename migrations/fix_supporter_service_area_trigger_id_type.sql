-- Fix prevent_mixed_supporter_service_areas() for existing databases.
-- supporter_service_areas.id is bigint, so do not compare it with a generated UUID.

CREATE OR REPLACE FUNCTION prevent_mixed_supporter_service_areas()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM supporter_service_areas ssa
        WHERE ssa.organization_id = NEW.organization_id
          AND ssa.country = NEW.country
          AND ssa.is_nationwide <> NEW.is_nationwide
          AND (NEW.id IS NULL OR ssa.id <> NEW.id)
    ) THEN
        RAISE EXCEPTION 'nationwide and regional service areas cannot coexist for the same organization and country';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
