import assert from 'node:assert/strict';
import { DamageEngine } from '../js/damage-engine.js';

const result = DamageEngine.runTests();
assert.ok(result.total > 0, 'The engine must run at least one assertion');
assert.deepEqual(result.failures, [], 'Damage engine regression failed');
assert.equal(result.passed, result.total);
