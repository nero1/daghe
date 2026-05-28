import assert from 'node:assert/strict';

const calc=(retry)=>Math.min(60000,1000*2**retry);
assert.equal(calc(0),1000);
assert.equal(calc(1),2000);
assert.equal(calc(10),60000);
console.log('sync-backoff.test.mjs passed');

