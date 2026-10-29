const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('web client integrates independent API',()=>{const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');assert.match(html,/\/api\/login/);assert.match(html,/\/api\/tasks/);assert.match(html,/function renderTable/);assert.match(html,/exportFilteredToExcel/)});
test('database is gitignored',()=>{const ignore=fs.readFileSync(path.join(__dirname,'../.gitignore'),'utf8');assert.match(ignore,/data\/\*/);assert.match(ignore,/\.env/)});
test('browser adapter supports chained authentication and other Node API operations',()=>{
 const vm=require('node:vm');const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const start=html.indexOf('    function callServer('),end=html.indexOf('    let allTasks = [];',start);
 const source=html.slice(start,end);
 const context=vm.createContext({Promise,apiCall:async(url)=>({success:true,url}),showToast:()=>{}});
 const getRunner=vm.runInContext(source+'\ngoogle.script.run',context);
 for(const name of ['authenticateUser','getSystemData','changePasswordFirstTime','saveTask','deleteTask'])assert.equal(typeof getRunner.withSuccessHandler(()=>{}).withFailureHandler(()=>{})[name],'function');
 assert.doesNotMatch(html,/UBMTTQVN XÃ KHUN HÁ/);
});
