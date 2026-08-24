import test from 'node:test';import assert from 'node:assert/strict';import {allocateOpenItems} from '../src/open-items.mjs';
test('allocates AR/AP open items exactly',()=>{const r=allocateOpenItems({paymentAmount:'150',items:[{id:'i1',openAmount:'100'},{id:'i2',openAmount:'80'}],allocations:[{itemId:'i1',amount:'100'},{itemId:'i2',amount:'50'}]});assert.equal(r.unallocatedMinor,0n)});
test('rejects over allocation',()=>{assert.throws(()=>allocateOpenItems({paymentAmount:'50',items:[{id:'i1',openAmount:'40'}],allocations:[{itemId:'i1',amount:'41'}]}),/ALLOCATION_EXCEEDS_OPEN_ITEM/)});
