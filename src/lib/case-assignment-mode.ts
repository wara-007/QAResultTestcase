export type AssignmentMode = {projectId:string;keys:string[];editing:boolean};
export type AssignmentModeAction = {type:'open';projectId:string}|{type:'close'}|{type:'select';projectId:string;keys:string[]};
export function assignmentModeReducer(state:AssignmentMode, action:AssignmentModeAction):AssignmentMode {
  if(action.type==='close') return {projectId:'',keys:[],editing:false};
  if(action.type==='open') return {projectId:action.projectId,keys:[],editing:true};
  if(!state.editing || state.projectId!==action.projectId) return state;
  return {...state,keys:action.keys};
}
export function isAssignmentEditing(state:AssignmentMode, projectId:string|null|undefined, canEdit:boolean):boolean {
  return canEdit && state.editing && state.projectId===projectId;
}
