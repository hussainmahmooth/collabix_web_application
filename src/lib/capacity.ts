import type { Role } from './types';
export function workspaceCapacity(members: { role: Role }[]) {
 const team = members.filter(m => m.role !== 'supervisor').length;
 const supervisors = members.filter(m => m.role === 'supervisor').length;
 return { team, supervisors, canInviteMember: team < 6, canInviteSupervisor: supervisors < 1, full: team >= 6 && supervisors >= 1 };
}
