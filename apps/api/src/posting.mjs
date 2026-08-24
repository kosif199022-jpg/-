import crypto from 'node:crypto';
function stableHash(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export async function postJournal(client,{organizationId,journalId,actorId,idempotencyKey,requestId,correlationId}){
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try{
    await client.query("SELECT set_config('altareeq.user_id',$1,true), set_config('altareeq.organization_id',$2,true)",[actorId,organizationId]);
    const payloadHash=stableHash({organizationId,journalId});
    const prior=await client.query("SELECT payload_hash,result_json FROM command_idempotency WHERE organization_id=$1::uuid AND command_type='journal.post' AND idempotency_key=$2",[organizationId,idempotencyKey]);
    if(prior.rows[0]){ if(prior.rows[0].payload_hash!==payloadHash) throw Object.assign(new Error('IDEMPOTENCY_CONFLICT'),{status:409}); await client.query('COMMIT'); return prior.rows[0].result_json; }
    const jr=await client.query("SELECT j.id::text,j.status,j.preparer_id::text,j.approver_id::text,p.status AS period_status FROM journals j JOIN fiscal_periods p ON p.id=j.period_id WHERE j.id=$1::uuid AND j.organization_id=$2::uuid FOR UPDATE",[journalId,organizationId]);
    const j=jr.rows[0]; if(!j) throw Object.assign(new Error('JOURNAL_NOT_FOUND'),{status:404}); if(j.status!=='approved') throw Object.assign(new Error('JOURNAL_NOT_APPROVED'),{status:409}); if(j.period_status!=='open') throw Object.assign(new Error('PERIOD_CLOSED'),{status:409}); if(j.preparer_id===actorId) throw Object.assign(new Error('SEPARATION_OF_DUTIES_VIOLATION'),{status:403});
    const totals=await client.query("SELECT COALESCE(sum(debit_minor),0)::text AS debit,COALESCE(sum(credit_minor),0)::text AS credit,count(*)::int AS lines FROM journal_lines WHERE journal_id=$1::uuid",[journalId]); const t=totals.rows[0]; if(t.lines<2||t.debit!==t.credit||t.debit==='0') throw Object.assign(new Error('JOURNAL_UNBALANCED'),{status:422});
    const prev=await client.query('SELECT sequence_no,posting_hash FROM posting_events WHERE organization_id=$1::uuid ORDER BY sequence_no DESC LIMIT 1 FOR UPDATE',[organizationId]); const seq=Number(prev.rows[0]?.sequence_no||0)+1; const previousHash=prev.rows[0]?.posting_hash||''; const postingHash=stableHash({organizationId,journalId,seq,previousHash,debit:t.debit,credit:t.credit});
    await client.query("UPDATE journals SET status='posted',posted_at=now() WHERE id=$1::uuid",[journalId]);
    await client.query('INSERT INTO posting_events(organization_id,journal_id,sequence_no,previous_hash,posting_hash,actor_id) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::uuid)',[organizationId,journalId,seq,previousHash,postingHash,actorId]);
    const result={journalId,status:'posted',sequenceNo:seq,postingHash};
    await client.query("INSERT INTO business_audit_events(organization_id,actor_id,event_type,entity_type,entity_id,request_id,correlation_id,details) VALUES($1::uuid,$2::uuid,'journal.posted','journal',$3::uuid,$4,$5,$6::jsonb)",[organizationId,actorId,journalId,requestId,correlationId,JSON.stringify({postingHash,sequenceNo:seq})]);
    await client.query("INSERT INTO command_idempotency(organization_id,command_type,idempotency_key,payload_hash,result_json) VALUES($1::uuid,'journal.post',$2,$3,$4::jsonb)",[organizationId,idempotencyKey,payloadHash,JSON.stringify(result)]);
    await client.query('COMMIT'); return result;
  }catch(e){try{await client.query('ROLLBACK')}catch{} throw e;}
}
