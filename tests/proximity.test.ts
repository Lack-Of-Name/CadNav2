// CadNav 2 tests — Copyright (C) 2026 Lyren, Alexander Ellul
// SPDX-License-Identifier: LGPL-3.0-or-later
/**
 * Tests for the compass "arrived" predicate.
 *
 * A GPS fix reports a 68%-confidence radius (`coords.accuracy`). When the
 * distance to the selected checkpoint is inside that radius we cannot
 * honestly say the user is anywhere else, so the compass ring/housing turns
 * to the route colour. These tests pin the boundary behaviour so the UI
 * never flips on a bogus or missing number.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isWithinAccuracy } from '../lib/proximity.ts';

describe('isWithinAccuracy', () => {
  it('is true when the distance is inside the accuracy radius', () => {
    assert.equal(isWithinAccuracy(5, 30), true);
    assert.equal(isWithinAccuracy(0, 0), true);
    assert.equal(isWithinAccuracy(29.9, 30), true);
  });

  it('is false once the distance exceeds the accuracy radius', () => {
    assert.equal(isWithinAccuracy(30.1, 30), false);
    assert.equal(isWithinAccuracy(100, 10), false);
    assert.equal(isWithinAccuracy(1000, 1), false);
  });

  it('treats the boundary distance as arrived (inclusive)', () => {
    assert.equal(isWithinAccuracy(30, 30), true);
  });

  it('is false without a distance (no fix or no target)', () => {
    assert.equal(isWithinAccuracy(null, 30), false);
    assert.equal(isWithinAccuracy(undefined, 30), false);
    assert.equal(isWithinAccuracy(NaN, 30), false);
    assert.equal(isWithinAccuracy(Infinity, 30), false);
  });

  it('is false without an accuracy (fix has not reported one yet)', () => {
    assert.equal(isWithinAccuracy(5, null), false);
    assert.equal(isWithinAccuracy(5, undefined), false);
    assert.equal(isWithinAccuracy(5, NaN), false);
    assert.equal(isWithinAccuracy(5, Infinity), false);
  });

  it('is false for negative or nonsensical inputs', () => {
    assert.equal(isWithinAccuracy(-1, 30), false);
    assert.equal(isWithinAccuracy(5, -1), false);
  });

  it('reflects real GPS accuracy ranges (coarse fix → early arrival)', () => {
    // A poor urban fix (±50 m) flags arrival well before a precise one (±3 m).
    const distance = 40;
    assert.equal(isWithinAccuracy(distance, 50), true, 'poor fix should read as arrived');
    assert.equal(isWithinAccuracy(distance, 3), false, 'precise fix should not');
  });
});
