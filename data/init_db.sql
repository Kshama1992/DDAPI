CREATE SCHEMA brand;
CREATE SCHEMA company;
CREATE SCHEMA email;
CREATE SCHEMA feed;
CREATE SCHEMA "group";
CREATE SCHEMA invoice;
CREATE SCHEMA location;
CREATE SCHEMA log;
CREATE SCHEMA message;
CREATE SCHEMA refund;
CREATE SCHEMA space;
CREATE SCHEMA subscription;
CREATE SCHEMA team;
CREATE SCHEMA ticket;
CREATE SCHEMA "user";

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';
