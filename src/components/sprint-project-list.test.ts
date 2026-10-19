import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SprintProjectList } from './sprint-project-list';
import { buildSprintDashboard } from '../lib/sprint-dashboard';
import type { Project } from '../lib/types';
test('Sprint list renders current work and a scope filter without edit controls for archived rows',()=>{
 const project:Project={id:'p',name:'Project',description:'',sprintNo:'67',environment:'UAT',sprintId:'67',googleSheetId:'',googleSheetUrl:'',createdAt:'',canView:true,canEdit:true,canManage:true,canDelete:true};
 const data=buildSprintDashboard({sprintId:'67',projects:[project],team:[],assignments:[],stats:[],approvals:[],origins:[],moves:[]});
 const html=renderToStaticMarkup(React.createElement(SprintProjectList,{data,groupId:'g',year:2026}));
 assert.match(html,/Project/);assert.match(html,/ทำอยู่ใน Sprint นี้/);assert.match(html,/ส่งต่อแล้ว/);assert.match(html,/\/groups\/g\/projects\/p\/test-cases/);
});
