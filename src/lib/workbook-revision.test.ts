import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { workbookContentRevision } from './workbook-revision';
const archive=(value:string,image:string,modified:string)=>zipSync({'xl/worksheets/sheet1.xml':strToU8(`<worksheet><v>${value}</v></worksheet>`),'xl/media/image1.png':strToU8(image),'docProps/core.xml':strToU8(modified)});
test('content revision ignores export timestamps but catches cells and images',()=>{
 const base=workbookContentRevision(archive('Step1','image-a','time-one'));
 assert.equal(workbookContentRevision(archive('Step1','image-a','time-two')),base);
 assert.notEqual(workbookContentRevision(archive('Step2','image-a','time-one')),base);
 assert.notEqual(workbookContentRevision(archive('Step1','image-b','time-one')),base);
});
test('export media numbering and generated picture names do not create false changes',()=>{
 const first=zipSync({'xl/media/image1.png':strToU8('a'),'xl/media/image2.png':strToU8('b'),'xl/drawings/drawing1.xml':strToU8('<drawing><pic><nvPicPr><cNvPr name="Picture 1" descr="proof"/></nvPicPr></pic></drawing>'),'xl/drawings/_rels/drawing1.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="../media/image1.png"/></Relationships>')});
 const second=zipSync({'xl/media/image1.png':strToU8('b'),'xl/media/image2.png':strToU8('a'),'xl/drawings/drawing1.xml':strToU8('<drawing><pic><nvPicPr><cNvPr name="Picture 2" descr="proof"/></nvPicPr></pic></drawing>'),'xl/drawings/_rels/drawing1.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="../media/image2.png"/></Relationships>')});
 assert.equal(workbookContentRevision(first),workbookContentRevision(second));
});

const spreadsheetNamespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function reorderedWorkbook(swapped:boolean, changedText=false, changedStyle=false) {
 const strings=swapped?['second','first']:['first','second'];
 if(changedText)strings[strings.indexOf('first')]='changed';
 const fonts=swapped?['<font><i/></font>','<font><b/></font>']:['<font><b/></font>','<font><i/></font>'];
 if(changedStyle)fonts[swapped?1:0]='<font><u/></font>';
 const xfs=swapped?'<xf fontId="0" numFmtId="166"/><xf fontId="1" numFmtId="165"/>':'<xf fontId="0" numFmtId="164"/><xf fontId="1" numFmtId="165"/>';
 const numFmts=swapped?'<numFmt numFmtId="166" formatCode="0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>':'<numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="0.00"/>';
 return zipSync({
  'xl/sharedStrings.xml':strToU8(`<sst xmlns="${spreadsheetNamespace}" count="2" uniqueCount="2">${strings.map(text=>`<si><t>${text}</t></si>`).join('')}</sst>`),
  'xl/styles.xml':strToU8(`<styleSheet xmlns="${spreadsheetNamespace}"><numFmts count="2">${numFmts}</numFmts><fonts count="2">${fonts.join('')}</fonts><cellXfs count="2">${xfs}</cellXfs></styleSheet>`),
  'xl/worksheets/sheet1.xml':strToU8(`<worksheet xmlns="${spreadsheetNamespace}"><cols><col min="1" max="1" style="${swapped?1:0}"/></cols><sheetData><row r="1" s="${swapped?1:0}"><c r="A1" t="s" s="${swapped?1:0}"><v>${swapped?1:0}</v></c><c r="B1" t="s" s="${swapped?0:1}"><v>${swapped?0:1}</v></c></row></sheetData></worksheet>`),
 });
}
test('shared string and style table permutations are not source changes',()=>{
 assert.equal(workbookContentRevision(reorderedWorkbook(false)),workbookContentRevision(reorderedWorkbook(true)));
});
test('resolved text and formatting changes still change the source revision',()=>{
 const original=workbookContentRevision(reorderedWorkbook(false));
 assert.notEqual(original,workbookContentRevision(reorderedWorkbook(true,true)));
 assert.notEqual(original,workbookContentRevision(reorderedWorkbook(true,false,true)));
});

test('implicit style zero still detects formatting changes when dictionaries move',()=>{
 const before=unzipSync(reorderedWorkbook(false));
 const after=unzipSync(reorderedWorkbook(true));
 for(const files of [before,after]) files['xl/worksheets/sheet1.xml']=strToU8(strFromU8(files['xl/worksheets/sheet1.xml']).replace(/(<c r="A1" t="s") s="[01]"/,'$1'));
 assert.notEqual(workbookContentRevision(zipSync(before)),workbookContentRevision(zipSync(after)));
});
test('changing a cell reference is detected even when dictionary inventories are unchanged',()=>{
 const before=unzipSync(reorderedWorkbook(false));
 const after={...before,'xl/worksheets/sheet1.xml':strToU8(strFromU8(before['xl/worksheets/sheet1.xml']).replace('<v>0</v>','<v>1</v>'))};
 assert.notEqual(workbookContentRevision(zipSync(before)),workbookContentRevision(zipSync(after)));
});
