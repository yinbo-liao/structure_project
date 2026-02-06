-- PostgreSQL Database Initialization Script
-- For Project QA Data Management System

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schema for better organization (optional)
CREATE SCHEMA IF NOT EXISTS project_qa;

-- Set search path for convenience
SET search_path TO project_qa, public;

-- Create custom types if needed
CREATE TYPE inspection_result AS ENUM ('PASS', 'FAIL', 'PENDING', 'REWORK');
CREATE TYPE ndt_method AS ENUM ('RT', 'UT', 'MT', 'PT', 'VT');
CREATE TYPE project_type AS ENUM ('PIPE', 'STRUCTURE');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for audit logging
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name, 
        record_id, 
        action, 
        old_data, 
        new_data, 
        changed_by,
        changed_at
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        current_user,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for data validation
CREATE OR REPLACE FUNCTION validate_project_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate project dates
    IF NEW.start_date > NEW.end_date THEN
        RAISE EXCEPTION 'Project start date cannot be after end date';
    END IF;
    
    -- Validate project code format (example: PRJ-2024-001)
    IF NEW.project_code IS NOT NULL AND NEW.project_code !~ '^PRJ-\d{4}-\d{3}$' THEN
        RAISE EXCEPTION 'Project code must be in format PRJ-YYYY-NNN';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for generating report numbers
CREATE OR REPLACE FUNCTION generate_report_number(project_id_param INTEGER, report_type_param TEXT)
RETURNS TEXT AS $$
DECLARE
    project_code TEXT;
    report_count INTEGER;
    report_number TEXT;
BEGIN
    -- Get project code
    SELECT project_code INTO project_code 
    FROM projects 
    WHERE id = project_id_param;
    
    IF project_code IS NULL THEN
        RAISE EXCEPTION 'Project not found';
    END IF;
    
    -- Count existing reports of this type for the project
    SELECT COUNT(*) INTO report_count
    FROM reports
    WHERE project_id = project_id_param 
    AND report_type = report_type_param;
    
    -- Generate report number
    report_number := project_code || '-' || UPPER(report_type_param) || '-' || LPAD((report_count + 1)::TEXT, 3, '0');
    
    RETURN report_number;
END;
$$ language 'plpgsql';

-- Create indexes for performance (some will be created by application, but these are critical)
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create materialized view for dashboard statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_statistics AS
SELECT 
    p.id as project_id,
    p.project_name,
    p.project_type,
    COUNT(DISTINCT pmjl.id) as total_joints,
    COUNT(DISTINCT CASE WHEN fi.final_result = 'PASS' THEN fi.id END) as passed_joints,
    COUNT(DISTINCT CASE WHEN fi.final_result = 'FAIL' THEN fi.id END) as failed_joints,
    COUNT(DISTINCT CASE WHEN fi.final_result = 'PENDING' THEN fi.id END) as pending_joints,
    COUNT(DISTINCT mr.id) as total_materials,
    COUNT(DISTINCT wr.id) as total_welders,
    COUNT(DISTINCT wps.id) as total_wps
FROM projects p
LEFT JOIN pipe_master_joint_list pmjl ON pmjl.project_id = p.id AND p.project_type = 'PIPE'
LEFT JOIN structure_master_joint_list smjl ON smjl.project_id = p.id AND p.project_type = 'STRUCTURE'
LEFT JOIN pipe_final_inspection fi ON fi.project_id = p.id AND p.project_type = 'PIPE'
LEFT JOIN structure_final_inspection sfi ON sfi.project_id = p.id AND p.project_type = 'STRUCTURE'
LEFT JOIN pipe_material_register mr ON mr.project_id = p.id AND p.project_type = 'PIPE'
LEFT JOIN structure_material_register smr ON smr.project_id = p.id AND p.project_type = 'STRUCTURE'
LEFT JOIN welder_register wr ON wr.project_id = p.id
LEFT JOIN wps_register wps ON wps.project_id = p.id
GROUP BY p.id, p.project_name, p.project_type;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_statistics_project ON dashboard_statistics(project_id);

-- Create view for NDT status summary
CREATE OR REPLACE VIEW ndt_status_summary AS
SELECT 
    p.id as project_id,
    p.project_name,
    p.project_type,
    ns.ndt_type,
    COUNT(*) as total_tests,
    COUNT(CASE WHEN ns.ndt_result = 'ACCEPTED' THEN 1 END) as accepted,
    COUNT(CASE WHEN ns.ndt_result = 'REJECTED' THEN 1 END) as rejected,
    COUNT(CASE WHEN ns.ndt_result = 'PENDING' THEN 1 END) as pending,
    ROUND(AVG(ns.ndt_length)::NUMERIC, 2) as avg_length,
    SUM(ns.rejected_length) as total_rejected_length
FROM projects p
LEFT JOIN pipe_ndt_status_records ns ON ns.project_id = p.id AND p.project_type = 'PIPE'
LEFT JOIN structure_ndt_status_records sns ON sns.project_id = p.id AND p.project_type = 'STRUCTURE'
GROUP BY p.id, p.project_name, p.project_type, ns.ndt_type;

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_statistics;
END;
$$ language 'plpgsql';

-- Create scheduled job for refreshing statistics (requires pg_cron extension)
-- Uncomment if pg_cron is installed:
-- SELECT cron.schedule('refresh-dashboard-stats', '0 */2 * * *', 'SELECT refresh_dashboard_statistics()');

-- Create user for application with limited permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password_123';
    END IF;
END
$$;

-- Grant permissions to app_user
GRANT CONNECT ON DATABASE project_management TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Create read-only user for reporting
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'report_user') THEN
        CREATE ROLE report_user WITH LOGIN PASSWORD 'report_password_123';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE project_management TO report_user;
GRANT USAGE ON SCHEMA public TO report_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO report_user;
GRANT SELECT ON dashboard_statistics TO report_user;
GRANT SELECT ON ndt_status_summary TO report_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO report_user;

-- Log initialization completion
INSERT INTO audit_logs (table_name, action, changed_by, changed_at, notes)
VALUES ('system', 'INITIALIZATION', 'postgres', CURRENT_TIMESTAMP, 'Database initialized with schema and functions');

COMMENT ON DATABASE project_management IS 'Project QA Data Management System Database';
