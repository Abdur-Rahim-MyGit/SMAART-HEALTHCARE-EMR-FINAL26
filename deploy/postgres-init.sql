-- Least-privilege application role: DML only, subject to row level security. The migrator owns the schema.
CREATE ROLE smaart_app LOGIN PASSWORD 'smaart_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE smaart_emr TO smaart_app;
