export function canApprove({preparerId,approverId,requiresFourEyes=true}) {
  if (!approverId) return {ok:false,code:'APPROVER_REQUIRED'};
  if (requiresFourEyes && preparerId === approverId) return {ok:false,code:'SEPARATION_OF_DUTIES_VIOLATION'};
  return {ok:true};
}
export function organizationScope(actorOrganizationIds, requestedOrganizationId) {
  if (!requestedOrganizationId) return {ok:false,code:'ORGANIZATION_SELECTION_REQUIRED'};
  return actorOrganizationIds.includes(requestedOrganizationId) ? {ok:true,organizationId:requestedOrganizationId} : {ok:false,code:'ORGANIZATION_ACCESS_DENIED'};
}
