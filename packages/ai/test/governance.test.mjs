import test from 'node:test';import assert from 'node:assert/strict';import {sanitizeAdvisoryOutput,assertAiToolScope} from '../src/governance.mjs';
test('strips authority fields recursively',()=>{const r=sanitizeAdvisoryOutput({analysis:'x',final_opinion:'clean',nested:{posted_entry:{id:1}}});assert.deepEqual(r,{analysis:'x',nested:{}})});
test('AI cannot call binding authority tools',()=>{assert.throws(()=>assertAiToolScope('journal.post'),/AI_AUTHORITY_FORBIDDEN/);assert.equal(assertAiToolScope('knowledge.search'),true)});
