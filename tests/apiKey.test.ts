// CadNav 2 tests - Copyright (C) 2026 Lyren, Alexander Ellul
// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAPTILER_KEY_MAX_LENGTH,
  MAPTILER_KEY_MIN_LENGTH,
  maskApiKey,
  parseApiKeyInput,
} from '../lib/apiKey.ts';

const KEY = '7dlm3nXf3v0X0X0X0X0X0X0X0X0X0X0X0X0X0';

describe('parseApiKeyInput', () => {
  it('accepts a raw key and trims surrounding whitespace', () => {
    assert.equal(parseApiKeyInput(`  ${KEY}\n`), KEY);
  });

  it('accepts quoted keys copied from chat or docs', () => {
    assert.equal(parseApiKeyInput(`"${KEY}"`), KEY);
    assert.equal(parseApiKeyInput(`'${KEY}'`), KEY);
    assert.equal(parseApiKeyInput('`' + KEY + '`'), KEY);
  });

  it('extracts the key from a MapTiler style URL', () => {
    assert.equal(
      parseApiKeyInput(`https://api.maptiler.com/maps/outdoor-v2/style.json?key=${KEY}`),
      KEY,
    );
    assert.equal(
      parseApiKeyInput(`https://api.maptiler.com/tiles/abc.png?foo=1&key=${KEY}&bar=2`),
      KEY,
    );
  });

  it('extracts and decodes keys from partial URL-like input', () => {
    assert.equal(parseApiKeyInput(`style.json?key=${KEY}`), KEY);
    assert.equal(parseApiKeyInput(`?key=${encodeURIComponent(KEY)}`), KEY);
  });

  it('rejects prose, URLs without a key and empty input', () => {
    assert.equal(parseApiKeyInput(null), null);
    assert.equal(parseApiKeyInput(undefined), null);
    assert.equal(parseApiKeyInput(''), null);
    assert.equal(parseApiKeyInput('   '), null);
    assert.equal(parseApiKeyInput('here is my key: ' + KEY), null);
    assert.equal(parseApiKeyInput('https://cloud.maptiler.com/account/keys/'), null);
  });

  it('rejects values that are too short, too long or contain whitespace', () => {
    assert.equal(parseApiKeyInput('a'.repeat(MAPTILER_KEY_MIN_LENGTH - 1)), null);
    assert.equal(parseApiKeyInput('a'.repeat(MAPTILER_KEY_MIN_LENGTH)), 'a'.repeat(MAPTILER_KEY_MIN_LENGTH));
    assert.equal(parseApiKeyInput('a'.repeat(MAPTILER_KEY_MAX_LENGTH)), 'a'.repeat(MAPTILER_KEY_MAX_LENGTH));
    assert.equal(parseApiKeyInput('a'.repeat(MAPTILER_KEY_MAX_LENGTH + 1)), null);
    assert.equal(parseApiKeyInput('abc def ghi jkl mno pqr'), null);
  });
});

describe('maskApiKey', () => {
  it('keeps a recognisable prefix and suffix', () => {
    assert.equal(maskApiKey(KEY), `${KEY.slice(0, 6)}...${KEY.slice(-4)}`);
  });

  it('does not throw on short or missing keys', () => {
    assert.equal(maskApiKey(null), null);
    assert.equal(maskApiKey(undefined), null);
    assert.equal(maskApiKey('short'), 'sh...');
  });
});
