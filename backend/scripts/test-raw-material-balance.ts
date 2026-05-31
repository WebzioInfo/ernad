import assert from 'node:assert/strict';
import { sumRawMaterialTransactions } from '../src/modules/inventory/raw-material-balance.util';

function balance(changes: number[]) {
  return sumRawMaterialTransactions(changes.map(quantityChange => ({ quantityChange })));
}

// Case 1: Stock = 100, Usage = 4, Expected = 96
assert.equal(balance([100, -4]), 96);

// Case 2: Stock = 50, Usage = 10, Expected = 40
assert.equal(balance([50, -10]), 40);

// Case 3: Edit usage from 4 to 6.
// Original deduction reversed: +4. New deduction: -6. Net change: -2.
assert.equal(balance([100, -4, 4, -6]), 94);
assert.equal(balance([-4, 4, -6]), -6);

// Case 4: Delete production log restores consumed quantity.
assert.equal(balance([100, -4, 4]), 100);

console.log('Raw material balance regression tests passed.');

