-- Fixes the demo/test accounts seeded by supabase_schema.sql: their original
-- password_hash values were invalid placeholders (not real bcrypt hashes), so
-- login always failed for admin@mediclinic.com, aminata@mediclinic.com, etc.
-- Run this once in the Supabase SQL editor against your existing database.
-- Safe to re-run; only touches these known demo emails, no other data.

UPDATE users SET password_hash = '$2a$10$.xGSl.knQiHJcilqpOtTHe4MGzHSyZlM3GofsduMrbYs9PRv4eJ/S' WHERE email = 'admin@mediclinic.com';
UPDATE users SET password_hash = '$2a$10$pzFlMyOI2De.LWBD.s96Guj/Sb6QiNJSjh6XBp5le1iaEy4k.6GLe' WHERE email = 'aminata@mediclinic.com';
UPDATE users SET password_hash = '$2a$10$pzFlMyOI2De.LWBD.s96Guj/Sb6QiNJSjh6XBp5le1iaEy4k.6GLe' WHERE email = 'ibrahim@mediclinic.com';
UPDATE users SET password_hash = '$2a$10$pqpzshRqNERXn6SxqO.OJOFQoq4tqqH/02igbXW47ZY/KoAH9.p36' WHERE email = 'bernard@mediclinic.com';
UPDATE users SET password_hash = '$2a$10$N57s2TbUloU2fSjKxdh/7.w/GUjweOTtC0teKrNg7NxO1fivUlmZG' WHERE email = 'moussa@mediclinic.com';
UPDATE users SET password_hash = '$2a$10$ztStKuicP1UrLU57MIzIo.uqvxAyjKYYkbEsJ4MOH1g1Sn4xo/EKS' WHERE email = 'fatou@mediclinic.com';
UPDATE users SET password_hash = '$2a$10$1kZ1iuBuOROPMFY26C3SHONfVFCsuXHQJnJ9NRGfGW.UWEJDwA/72' WHERE email = 'kouassi@mediclinic.com';
