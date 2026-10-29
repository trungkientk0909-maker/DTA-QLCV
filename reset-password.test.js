const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const port=()=>new Promise(resolve=>{let s=net.createServer();s.listen(0,'127.0.0.1',()=>{let p=s.address().port;s.close(()=>resolve(p))})});
test('admin can reset another account and invalidate prior sessions without losing admin session',{timeout:20000},async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dta-reset-')),p=await port(),child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,DATA_DIR:dir,PORT:String(p),ADMIN_PASSWORD:'AdminStrongPass#123'},stdio:'ignore'});
const req=(url,method='GET',body,cookie)=>fetch(`http://127.0.0.1:${p}${url}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{})},body:body?JSON.stringify(body):undefined});
const login=async(u,pwd)=>{const r=await req('/api/login','POST',{username:u,password:pwd});return [r.status,r.headers.get('set-cookie')?.split(';')[0]]};
try{for(let i=0;i<50;i++){try{if((await req('/')).ok)break}catch{}await new Promise(r=>setTimeout(r,80))}
let [status,admin]=await login('admin','AdminStrongPass#123');assert.equal(status,200);assert.equal((await req('/api/change-password','POST',{newPassword:'NewAdminStrong#234'},admin)).status,200);[status,admin]=await login('admin','NewAdminStrong#234');assert.equal(status,200);
assert.equal((await req('/api/admin/departments','POST',{name:'Phòng Test'},admin)).status,200);
assert.equal((await req('/api/admin/users','POST',{username:'tester',password:'InitPassword#123',fullName:'Người Thử',department:'Phòng Test',role:'User'},admin)).status,200);
let user;[status,user]=await login('tester','InitPassword#123');assert.equal(status,200);assert.equal((await req('/api/change-password','POST',{newPassword:'ChangedPassword#123'},user)).status,200);[status,user]=await login('tester','ChangedPassword#123');assert.equal(status,200);
assert.equal((await req('/api/admin/users/reset-password','POST',{username:'admin',newPassword:'ResetAdmin#123'},admin)).status,403);
assert.equal((await req('/api/admin/users/reset-password','POST',{username:'admin',newPassword:'ResetAdmin#123'},user)).status,403);
assert.equal((await req('/api/admin/users/reset-password','POST',{username:'tester',newPassword:'ResetPassword#123'},admin)).status,200);
assert.equal((await req('/api/data','GET',undefined,user)).status,401);
assert.equal((await login('tester','ChangedPassword#123'))[0],401);
[status,user]=await login('tester','ResetPassword#123');assert.equal(status,200);
assert.equal((await req('/api/data','GET',undefined,user)).status,403);
assert.equal((await req('/api/admin/users','GET',undefined,admin)).status,200);
assert.equal((await req('/admin.html')).headers.get('x-frame-options'),'SAMEORIGIN');
}finally{child.kill();fs.rmSync(dir,{recursive:true,force:true})}
});
