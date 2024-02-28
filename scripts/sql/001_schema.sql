-- Drop existing tables to ensure recreation
DROP TABLE IF EXISTS builder_market_types CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS market_types CASCADE;
DROP TABLE IF EXISTS builders CASCADE;

-- Create builders table
CREATE TABLE builders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Create market_types table
CREATE TABLE market_types (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255) UNIQUE NOT NULL
);

-- Create assets table
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    builder_id INTEGER REFERENCES builders(id),
    name VARCHAR(255) NOT NULL,
    market_type_id INTEGER REFERENCES market_types(id),
    start_date DATE NOT NULL,
    end_date DATE
);

-- Create builder_market_types table
CREATE TABLE builder_market_types (
    id SERIAL PRIMARY KEY,
    builder_id INTEGER REFERENCES builders(id),
    market_type_id INTEGER REFERENCES market_types(id)
);
