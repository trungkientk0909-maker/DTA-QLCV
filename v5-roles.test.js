const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
async function freeport(){let s=net.createServer();return new Promise(r=>s.listen(0,'127.0.0.1',()=>{let p=s.address().port;s.close(()=>r(p))}))}
test('V5 department-only assignment, leaders, user CRUD and isolation', {timeout:25000}, async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dta-v5-')),p=await freeport(); const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,DATA_DIR:dir,PORT:String(p),ADMIN_PASSWORD:'TestAdminPass#12345'},stdio:'ignore'});
 async function request(endpoint,method='GET',body,cookie){return fetch(`http://127.0.0.1:${p}${endpoint}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined})}
 async function login(u,pass){let r=await request('/api/login','POST',{username:u,password:pass});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
 const post=async(endpoint,obj,c)=>request(endpoint,'POST',obj,c);
 try{for(let i=0;i<60;i++){try{if((await request('/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 let a=await login('admin','TestAdminPass#12345');assert.equal((await post('/api/change-password',{newPassword:'TestAdminPass#45678'},a)).status,200);a=await login('admin','TestAdminPass#45678');
 for(const name of ['Văn phòng','Tư pháp'])assert.equal((await post('/api/admin/departments',{name},a)).status,200);
 for(const [username,fullName,department,role] of [['chief','Trưởng Văn phòng','Văn phòng','Trưởng phòng'],['vice','Phó Văn phòng','Văn phòng','Phó phòng'],['staff','Chuyên viên A','Văn phòng','User'],['other','Chuyên viên B','Tư pháp','User']])assert.equal((await post('/api/admin/users',{username,password:'UserPassStrong#123',fullName,department,role},a)).status,200);
 assert.equal((await post('/api/tasks',{task:{ten:'Việc giao chung',cqPhuTrach:'Văn phòng',nguoi:''}},a)).status,200);
 let all=await (await request('/api/data','GET',undefined,a)).json();const common=all.tasks[0];assert.equal(common.assigneeUsername,null);
 let c=await login('chief','UserPassStrong#123');await post('/api/change-password',{newPassword:'NewPassStrong#123'},c);c=await login('chief','NewPassStrong#123');
 let v=await login('vice','UserPassStrong#123');await post('/api/change-password',{newPassword:'NewPassStrong#123'},v);v=await login('vice','NewPassStrong#123');
 let u=await login('staff','UserPassStrong#123');await post('/api/change-password',{newPassword:'NewPassStrong#123'},u);u=await login('staff','NewPassStrong#123');
 assert.equal((await (await request('/api/data','GET',undefined,c)).json()).tasks.length,1);
 assert.equal((await (await request('/api/data','GET',undefined,v)).json()).tasks.length,1);
 assert.equal((await (await request('/api/data','GET',undefined,u)).json()).tasks.length,0);
 assert.equal((await post('/api/tasks',{task:{id:common.id,ten:'Việc giao chung',cqPhuTrach:'Văn phòng',nguoi:'Chuyên viên A'}},c)).status,200);
 assert.equal((await (await request('/api/data','GET',undefined,u)).json()).tasks.length,1);
 assert.equal((await post('/api/admin/users/delete',{username:'staff'},a)).status,409);
 assert.equal((await post('/api/admin/users/update',{username:'staff',fullName:'Chuyên viên A2',department:'Văn phòng',role:'User'},a)).status,200);
 assert.equal((await (await request('/api/data','GET',undefined,c)).json()).tasks[0].nguoi,'Chuyên viên A2');
 assert.equal((await post('/api/admin/users/delete',{username:'admin'},a)).status,403);
 assert.equal((await post('/api/admin/users/update',{username:'chief',fullName:'Trưởng Văn phòng 2',department:'Tư pháp',role:'Trưởng phòng'},a)).status,200);
 assert.equal((await post('/api/admin/users/delete',{username:'chief'},a)).status,200);
 assert.equal((await post('/api/admin/departments/delete',{name:'Văn phòng'},a)).status,409);
 assert.equal((await post('/api/admin/users/delete',{username:'vice'},u)).status,401);
 }finally{child.kill();fs.rmSync(dir,{recursive:true,force:true})}
});
