import test from 'node:test';
import assert from 'node:assert/strict';
import { globalProjectSearchResponse, searchPattern, nextSearchOption } from './global-project-search';

test('keyboard search starts at first/last item and wraps correctly',()=>{
  assert.equal(nextSearchOption(-1,25,'up'),24);
  assert.equal(nextSearchOption(-1,25,'down'),0);
  assert.equal(nextSearchOption(24,25,'down'),0);
  assert.equal(nextSearchOption(0,25,'up'),24);
  assert.equal(nextSearchOption(-1,0,'down'),-1);
});

test('search treats SQL wildcard characters as literal text', () => {
  assert.equal(searchPattern('  100%_QA\\test  '), '%100\\%\\_QA\\\\test%');
});
test('search requires authorization before returning data', async () => {
  let searched = false;
  const response = await globalProjectSearchResponse(new Request('http://localhost/api/projects/search?q=test'), {
    authorize: async () => { throw Object.assign(new Error('Login required'), {status:401}); },
    search: async () => { searched = true; return []; },
  });
  assert.equal(response.status,401);
  assert.equal(searched,false);
});
test('short queries do not query the database and responses cannot be cached publicly', async () => {
  const response = await globalProjectSearchResponse(new Request('http://localhost/api/projects/search?q=a'), {
    authorize: async () => {}, search: async () => { throw new Error('Must not query'); },
  });
  assert.deepEqual(await response.json(), {projects:[],hasMore:false});
  assert.match(response.headers.get('cache-control')!,/no-store/);
});
test('unapproved accounts cannot search and internal database errors are not exposed',async()=>{
  let searched=false;
  const denied=await globalProjectSearchResponse(new Request('http://localhost/api/projects/search?q=test'),{
    authorize:async()=>{throw Object.assign(new Error('Denied'),{status:403});},
    search:async()=>{searched=true;return [];},
  });
  assert.equal(denied.status,403);assert.equal(searched,false);
  const failed=await globalProjectSearchResponse(new Request('http://localhost/api/projects/search?q=test'),{
    authorize:async()=>{},search:async()=>{throw new Error('secret database details');},
  });
  assert.equal(failed.status,500);assert.doesNotMatch(await failed.text(),/secret/);
});
test('search caps results and builds routes across groups without exposing raw records', async () => {
  const response = await globalProjectSearchResponse(new Request('http://localhost/api/projects/search?q=test'), {
    authorize: async () => {},
    search: async pattern => {
      assert.equal(pattern,'%test%');
      return Array.from({length:26},(_,i)=>({id:`p${i}`,name:'Test',environment:'UAT',group_id:i%2?'g2':'g1',sprint_no:'Sprint 67',groups:{name:'Team'},sprints:{name:'Sprint 67',workspace_years:{year:2026}},secret:'not-returned'}));
    },
  });
  const result=await response.json();
  assert.equal(result.projects.length,25);
  assert.equal(result.hasMore,true);
  assert.equal(result.projects[1].href,'/groups/g2/projects/p1/overview');
  assert.equal(result.projects[0].year,2026);
  assert.equal(result.projects[0].secret,undefined);
});
