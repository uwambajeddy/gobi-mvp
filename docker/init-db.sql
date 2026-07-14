-- Creates the development and test databases used by the Gobi MVP API.
-- Runs once on first container start (files in /docker-entrypoint-initdb.d/).
CREATE DATABASE gobi_mvp_dev;
CREATE DATABASE gobi_mvp_test;
