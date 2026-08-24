import test from 'node:test'; import assert from 'node:assert/strict'; import { canApprove, organizationScope } from '../src/policy.mjs';
test('enforces four eyes',()=>{ assert.equal(canApprove({preparerId:'u1',approverId:'u1'}).code,'SEPARATION_OF_DUTIES_VIOLATION'); assert.equal(canApprove({preparerId:'u1',approverId:'u2'}).ok,true); });
test('denies cross organization scope',()=>{ assert.equal(organizationScope(['a'],'b').code,'ORGANIZATION_ACCESS_DENIED'); });
