const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const net = require('node:net');

async function pickPort(){return new Promise((resolve,reject)=>{const srv=net.createServer();srv.listen(0,'127.0.0.1',()=>{const port=srv.address().port;srv.close(()=>resolve(port))});srv.on('error',reject)})}
async function request(port,url,method='GET',body,cookie){return fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined})}
async function ready(port){for(let i=0;i<60;i++){try{let r=await request(port,'/');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Server did not start')}
test('login, first password change, task CRUD and Vietnamese branding', {timeout:20000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dta-test-'));
 const port=await pickPort();
 const child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{...process.env,PORT:String(port),DATA_DIR:dir,ADMIN_USER:'admin',ADMIN_PASSWORD:'StrongInitialPass#987'},stdio:'ignore'});
 try{
  await ready(port);
  const page=await (await request(port,'/')).text();
  assert.match(page,/DTA WORKSPACE/);
  assert.doesNotMatch(page,/UBND xã Khun Há<\/h2>/);
  assert.doesNotMatch(page,/UBMTTQVN XÃ KHUN HÁ/);
  let r=await request(port,'/api/login','POST',{username:'admin',password:'StrongInitialPass#987'});
  assert.equal(r.status,200);let payload=await r.json();assert.equal(payload.success,true);assert.equal(payload.requireChange,true);
  let cookie=r.headers.get('set-cookie').split(';')[0];
  r=await request(port,'/api/change-password','POST',{newPassword:'StrongerPassword#456'},cookie);
  assert.equal(r.status,200);
  r=await request(port,'/api/login','POST',{username:'admin',password:'StrongerPassword#456'});
  assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
  payload=await r.json();assert.equal(payload.requireChange,false);
  r=await request(port,'/api/data','GET',undefined,cookie);assert.equal(r.status,200);
  r=await request(port,'/api/admin/departments','POST',{name:'Phòng thử nghiệm'},cookie);assert.equal(r.status,200);
  r=await request(port,'/api/admin/users','POST',{username:'nguoidung01',password:'UserPassStrong#7788',fullName:'Người dùng thử nghiệm',department:'Phòng thử nghiệm',role:'User'},cookie);assert.equal(r.status,200);
  r=await request(port,'/api/tasks','POST',{task:{id:'testtask',ten:'Theo dõi văn bản',nguoi:'Người dùng thử nghiệm',cqPhuTrach:'Phòng thử nghiệm',trangThai:'Đang xử lý'}},cookie);
  assert.equal(r.status,200);const created=(await r.json()).task;
  r=await request(port,'/api/data','GET',undefined,cookie);payload=await r.json();assert.equal(payload.tasks.length,1);
  r=await request(port,'/api/tasks/delete','POST',{id:created.id},cookie);assert.equal(r.status,200);
 }finally{child.kill();fs.rmSync(dir,{recursive:true,force:true})}
});
