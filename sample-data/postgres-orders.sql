-- Seed data for exercising the PostgreSQL source and export.
--
-- Load it into the development database:
--   docker compose exec -T postgres psql -U pantaetl -d pantaetl < sample-data/postgres-orders.sql
--
-- The pipeline's own tables live in the public schema, so this data is kept in a
-- separate schema and can be dropped without touching control-plane state.

DROP SCHEMA IF EXISTS sample CASCADE;
CREATE SCHEMA sample;

CREATE TABLE sample.orders (
  order_id    integer PRIMARY KEY,
  order_date  date        NOT NULL,
  customer    text        NOT NULL,
  region      text,
  status      text        NOT NULL,
  quantity    integer,
  unit_price  numeric(10, 2) NOT NULL,
  updated_at  timestamptz NOT NULL
);

INSERT INTO sample.orders
  (order_id, order_date, customer, region, status, quantity, unit_price, updated_at)
VALUES
  (1001, '2026-07-01', 'Aurora Labs',    'north', 'shipped',   3,  249.00, '2026-07-01T08:15:00Z'),
  (1002, '2026-07-01', 'Belmont Foods',  'south', 'pending',  12,   18.50, '2026-07-01T09:40:00Z'),
  (1003, '2026-07-02', 'Cedar Works',    'north', 'shipped',   1, 1250.00, '2026-07-02T11:05:00Z'),
  (1004, '2026-07-02', 'Delta Print',    'east',  'cancelled', 5,   42.75, '2026-07-02T14:22:00Z'),
  (1005, '2026-07-03', 'Aurora Labs',    'north', 'shipped',   2,  249.00, '2026-07-03T07:58:00Z'),
  (1006, '2026-07-03', 'Everline Group', NULL,    'pending',   7,   99.99, '2026-07-03T16:30:00Z'),
  (1007, '2026-07-04', 'Belmont Foods',  'south', 'shipped',  20,   18.50, '2026-07-04T10:11:00Z'),
  (1008, '2026-07-04', 'Fjord Retail',   'west',  'shipped',   4,  315.00, '2026-07-04T13:47:00Z'),
  (1009, '2026-07-05', 'Cedar Works',    'north', 'pending',  NULL, 1250.00, '2026-07-05T09:03:00Z'),
  (1010, '2026-07-05', 'Granite Supply', 'east',  'shipped',   9,   67.25, '2026-07-05T15:19:00Z'),
  (1011, '2026-07-06', 'Harbor Media',   'south', 'cancelled', 2,  540.00, '2026-07-06T08:44:00Z'),
  (1012, '2026-07-06', 'Fjord Retail',   'west',  'shipped',   6,  315.00, '2026-07-06T12:26:00Z');

-- A read-only role keeps a Source connection from being able to modify the data
-- it reads. Grant the export its own privileges separately if you write back.
CREATE TABLE sample.orders_summary (
  region      text PRIMARY KEY,
  order_count integer NOT NULL,
  total_units integer NOT NULL
);

-- Append rows here to test incremental reads: set the source's checkpoint column
-- to updated_at, run the pipeline, insert a row with a later updated_at, and run
-- again. Only the newer row is read the second time.
