import test from 'node:test';import assert from 'node:assert/strict';import {systematicSample} from '../src/sampling.mjs';
test('systematic sample is reproducible for the same seed',()=>{const x=Array.from({length:100},(_,i)=>`j${i+1}`);assert.deepEqual(systematicSample(x,10,42n),systematicSample(x,10,42n));assert.equal(systematicSample(x,10,42n).length,10)});
