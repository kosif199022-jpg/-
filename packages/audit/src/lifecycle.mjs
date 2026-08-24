export const AUDIT_STAGES = Object.freeze(['acceptance','data_validation','planning_risk','pbc_evidence','fieldwork','findings_conclusions','adjustments_review','completion_reporting']);
export const NEXT_STAGE = Object.freeze(Object.fromEntries(AUDIT_STAGES.slice(0,-1).map((stage,i)=>[stage,AUDIT_STAGES[i+1]])));
export function canTransition({current,target,blockers=[],gates=[]}) {
  if (!AUDIT_STAGES.includes(current) || !AUDIT_STAGES.includes(target)) return {ok:false,code:'AUDIT_STAGE_INVALID'};
  if (NEXT_STAGE[current] !== target) return {ok:false,code:'AUDIT_STAGE_TRANSITION_FORBIDDEN'};
  const openBlocker = blockers.find(b => b.status !== 'resolved'); if (openBlocker) return {ok:false,code:'AUDIT_BLOCKER_OPEN',blockerId:openBlocker.id};
  const failedGate = gates.find(g => g.required && g.status !== 'passed'); if (failedGate) return {ok:false,code:'AUDIT_GATE_NOT_PASSED',gateId:failedGate.id};
  return {ok:true};
}
export function transitionEngagement(input) { const decision = canTransition(input); if (!decision.ok) return decision; return Object.freeze({ok:true,from:input.current,to:input.target,actorId:input.actorId,decisionId:input.decisionId}); }
