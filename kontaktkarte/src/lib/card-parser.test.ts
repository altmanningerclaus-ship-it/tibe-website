import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCardText } from './card-parser.ts';

test('österreichische Visitenkarte', () => {
  const r = parseCardText([
    'TIBE Technik GmbH',
    'Ing. Max Mustermann',
    'Geschäftsführer',
    'Industriestraße 12',
    'A-4020 Linz',
    'Tel. +43 732 123456',
    'Mobil +43 664 1234567',
    'Fax +43 732 123456-9',
    'max.mustermann@tibe.at',
    'www.tibe.at',
  ]);
  assert.equal(r.first_name, 'Max');
  assert.equal(r.last_name, 'Mustermann');
  assert.equal(r.company, 'TIBE Technik GmbH');
  assert.equal(r.position, 'Geschäftsführer');
  assert.equal(r.street, 'Industriestraße 12');
  assert.equal(r.postal_code, '4020');
  assert.equal(r.city, 'Linz');
  assert.equal(r.country, 'Österreich');
  assert.equal(r.phone, '+43 732 123456');
  assert.equal(r.mobile, '+43 664 1234567');
  assert.equal(r.email, 'max.mustermann@tibe.at');
  assert.equal(r.website, 'www.tibe.at');
});

test('deutsche Karte mit Mehrfach-Zeilen und Blöcken', () => {
  const r = parseCardText([
    'Dr. Anna von Berg\nLeiterin Vertrieb',
    'Beispiel AG',
    'Hauptstraße 5, 80331 München',
    'T: 089 123 456 | M: 0171 2345678',
    'anna.vonberg@beispiel.de',
  ]);
  assert.equal(r.first_name, 'Anna');
  assert.equal(r.last_name, 'von Berg');
  assert.equal(r.position, 'Leiterin Vertrieb');
  assert.equal(r.company, 'Beispiel AG');
  assert.equal(r.street, 'Hauptstraße 5');
  assert.equal(r.postal_code, '80331');
  assert.equal(r.city, 'München');
  assert.equal(r.country, 'Deutschland');
  assert.equal(r.phone, '089 123 456');
  assert.equal(r.mobile, '0171 2345678');
  assert.equal(r.website, 'www.beispiel.de');
});

test('Handynummer ohne Beschriftung, Freemail ohne Website', () => {
  const r = parseCardText(['SONNENSTUDIO', 'Petra Huber', '0664 123 45 67', 'petra.huber@gmail.com', 'Am Markt 3', '5020 Salzburg']);
  assert.equal(r.first_name, 'Petra');
  assert.equal(r.last_name, 'Huber');
  assert.equal(r.mobile, '0664 123 45 67');
  assert.equal(r.phone, '');
  assert.equal(r.website, '');
  assert.equal(r.company, 'SONNENSTUDIO');
  assert.equal(r.city, 'Salzburg');
  assert.equal(r.street, 'Am Markt 3');
});

test('Mobilnummer mit (0) und Schrägstrich', () => {
  const r = parseCardText(['Hans Meier', 'Meier & Partner OG', '+43 (0) 676 / 123 45 67', 'office@meier-partner.at']);
  assert.equal(r.mobile, '+43 (0) 676 / 123 45 67');
  assert.equal(r.company, 'Meier & Partner OG');
  assert.equal(r.website, 'www.meier-partner.at');
});
