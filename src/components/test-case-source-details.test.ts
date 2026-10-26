import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TestCaseSourceDetails} from './test-case-source-details';
import {casesFromRows} from '../lib/testcase-rows';
import {assignRegisterCaseIdentities} from '../lib/register-case-identity';
test('source details show original Sheet ID rather than the internal duplicate row key',()=>{
 const item=assignRegisterCaseIdentities(casesFromRows([['Testcase ID','Test Case Name'],['TC01','First'],['TC01','Second']]))[0];
 const markup=renderToStaticMarkup(React.createElement(TestCaseSourceDetails,{testCase:item}));
 assert.ok(markup.includes('TC01'));assert.ok(!markup.includes(item.id));
});
