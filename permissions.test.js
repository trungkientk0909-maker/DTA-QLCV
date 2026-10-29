const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
async function port(){const s=net.createServer();return new Promise(resolve=>s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))}))}
test('department creation and strict task isolation for users', {timeout:20000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dta-perms-')),p=await port();const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,DATA_DIR:dir,PORT:String(p),ADMIN_PASSWORD:'FirstPassSecure#123'},stdio:'ignore'});
 async function req(url,method='GET',body,cookie){return fetch(`http://127.0.0.1:${p}${url}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{})},body:body&&JSON.stringify(body)})}
 async function login(username,password){const r=await req('/api/login','POST',{username,password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
 try {for(let i=0;i<60;i++){try{if((await req('/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 let a=await login('admin','FirstPassSecure#123');assert.equal((await req('/api/change-password','POST',{newPassword:'SecondPassSecure#456'},a)).status,200);a=await login('admin','SecondPassSecure#456');
 assert.equal((await req('/api/admin/departments','POST',{name:'Văn phòng UBND'},a)).status,200);
 assert.equal((await req('/api/admin/departments','POST',{name:'Tư pháp'},a)).status,200);
 for(const [username,fullName,department] of [['an','Nguyễn Văn An','Văn phòng UBND'],['binh','Trần Bình','Văn phòng UBND'],['cuong','Lê Cường','Tư pháp']]){const r=await req('/api/admin/users','POST',{username:username+'000',password:'UserSecurePass#456',fullName,department,role:'User'},a);assert.equal(r.status,200)}
 for(const [ten,nguoi,dept] of [['A','Nguyễn Văn An','Văn phòng UBND'],['B','Trần Bình','Văn phòng UBND'],['C','Lê Cường','Tư pháp']])assert.equal((await req('/api/tasks','POST',{task:{ten,nguoi,cqPhuTrach:dept}},a)).status,200);
 const user=await login('an000','UserSecurePass#456');assert.equal((await req('/api/data','GET',undefined,user)).status,403);
 assert.equal((await req('/api/change-password','POST',{newPassword:'UpdatedUserPass#999'},user)).status,200);
 const au=await login('an000','UpdatedUserPass#999');const data=await (await req('/api/data','GET',undefined,au)).json();assert.deepEqual(data.tasks.map(t=>t.ten),['A']);
 assert.equal((await req('/api/admin/departments','POST',{name:'Không có quyền'},au)).status,403);
 const other=(await (await req('/api/data','GET',undefined,a)).json()).tasks.find(t=>t.ten==='B');assert.equal((await req('/api/tasks','POST',{task:{id:other.id,ngayHoanThanh:'2026-10-29'}},au)).status,403);
 } finally{child.kill();fs.rmSync(dir,{recursive:true,force:true})}
});
