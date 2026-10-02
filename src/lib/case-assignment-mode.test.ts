import assert from 'node:assert/strict';
import test from 'node:test';
import { assignmentModeReducer, isAssignmentEditing } from './case-assignment-mode';

test('assignment mode is hidden until opened by an editor for this Project',()=>{
  const initial={projectId:'',keys:[] as string[],editing:false};
  assert.equal(isAssignmentEditing(initial,'p',true),false);
  const opened=assignmentModeReducer(initial,{type:'open',projectId:'p'});
  assert.equal(isAssignmentEditing(opened,'p',true),true);
  assert.equal(isAssignmentEditing(opened,'q',true),false);
  assert.equal(isAssignmentEditing(opened,'p',false),false);
});
test('finishing clears selection and hides assignment tools',()=>{
  const closed=assignmentModeReducer({projectId:'p',keys:['case1'],editing:true},{type:'close'});
  assert.deepEqual(closed,{projectId:'',keys:[],editing:false});
});
test('opening another Project starts with no previous selections',()=>{
  const opened=assignmentModeReducer({projectId:'p',keys:['case1'],editing:true},{type:'open',projectId:'q'});
  assert.deepEqual(opened,{projectId:'q',keys:[],editing:true});
});
