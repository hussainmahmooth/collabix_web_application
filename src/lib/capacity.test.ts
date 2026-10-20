import { describe, expect, it } from 'vitest';
import { workspaceCapacity } from './capacity';
describe('six team members plus one supervisor', () => {
 it('counts leaders toward the six team places', () => {
  const result=workspaceCapacity([{role:'leader'},...Array.from({length:5},()=>({role:'member' as const}))]);
  expect(result.canInviteMember).toBe(false);expect(result.canInviteSupervisor).toBe(true);expect(result.full).toBe(false);
 });
 it('reserves exactly one separate supervisor place', () => {
  const result=workspaceCapacity([{role:'leader'},{role:'supervisor'}]);
  expect(result.canInviteMember).toBe(true);expect(result.canInviteSupervisor).toBe(false);
 });
 it('is full with six team members and one supervisor', () => {
  expect(workspaceCapacity([{role:'leader'},...Array.from({length:5},()=>({role:'member' as const})),{role:'supervisor'}]).full).toBe(true);
 });
});
