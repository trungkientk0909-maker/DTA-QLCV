const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
async function port(){let s=net.createServer();return new Promise(resolve=>s.listen(0,'127.0.0.1',()=>{let n=s.address().port;s.close(()=>resolve(n))}))}
test('Employee sends -> Đã gửi -> leader reviews -> Chờ thẩm định -> global admin approves',{timeout:25000},async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dta-status-')),p=await port();
const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,DATA_DIR:dir,PORT:String(p),ADMIN_PASSWORD:'TestAdminPass#12345'},stdio:'ignore'});
async function req(endpoint,method='GET',body,cookie){return fetch(`http://127.0.0.1:${p}${endpoint}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined})}
async function post(endpoint,body,cookie){return req(endpoint,'POST',body,cookie)}
async function login(u,pw){let r=await post('/api/login',{username:u,password:pw});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
try{
for(let i=0;i<60;i++){try{if((await req('/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
let admin=await login('admin','TestAdminPass#12345');await post('/api/change-password',{newPassword:'TestAdminPass#45678'},admin);admin=await login('admin','TestAdminPass#45678');
assert.equal((await post('/api/admin/departments',{name:'Văn phòng'},admin)).status,200);
for(const [username,fullName,role] of [['lead','Trưởng phòng A','Trưởng phòng'],['vice','Phó phòng A','Phó phòng'],['staff','Nhân viên A','User']])assert.equal((await post('/api/admin/users',{username,fullName,department:'Văn phòng',role,password:'TestPassword#123'},admin)).status,200);
let lead=await login('lead','TestPassword#123');await post('/api/change-password',{newPassword:'NewPassword#123'},lead);lead=await login('lead','NewPassword#123');
let vice=await login('vice','TestPassword#123');await post('/api/change-password',{newPassword:'NewPassword#123'},vice);vice=await login('vice','NewPassword#123');
let staff=await login('staff','TestPassword#123');await post('/api/change-password',{newPassword:'NewPassword#123'},staff);staff=await login('staff','NewPassword#123');
let create=await post('/api/tasks',{task:{ten:'Nhiệm vụ báo cáo',cqPhuTrach:'Văn phòng',nguoi:'Nhân viên A',han:'2099-01-01'}},admin);assert.equal(create.status,200);let task=(await create.json()).task;
let sent=await post('/api/tasks',{task:{id:task.id,ngayHoanThanh:'2026-10-30',trangThai:'Hoàn thành'}},staff);assert.equal(sent.status,200);assert.equal((await sent.json()).task.trangThai,'Đã gửi');
for(const c of [lead,vice]){const d=await (await req('/api/data','GET',null,c)).json();assert.equal(d.tasks[0].trangThai,'Đã gửi')}
assert.equal((await post('/api/tasks',{task:{id:task.id,ngayHoanThanh:'2026-10-30'}},staff)).status,403);
const leaderBack=await post('/api/tasks/transition',{id:task.id,action:'leader_return',note:'Sửa số liệu thống kê và bổ sung phụ lục'},lead);
assert.equal(leaderBack.status,200);assert.equal((await leaderBack.json()).task.trangThai,'Yêu cầu chỉnh sửa');
const returnedToStaff=(await (await req('/api/data','GET',null,staff)).json()).tasks[0];
assert.equal(returnedToStaff.lyDoTraLai,'Sửa số liệu thống kê và bổ sung phụ lục');
assert.equal(returnedToStaff.capTraLai,'Lãnh đạo phòng');
assert.equal(returnedToStaff.nguoiCanXuLy,'staff');
assert.equal((await post('/api/tasks/transition',{id:task.id,action:'resubmit',note:'Đã điều chỉnh số liệu và phụ lục'},staff)).status,200);
const afterResubmit=(await (await req('/api/data','GET',null,staff)).json()).tasks[0];
assert.equal(afterResubmit.trangThai,'Đã gửi');
assert.equal(afterResubmit.lyDoTraLaiTruoc,'Sửa số liệu thống kê và bổ sung phụ lục');
const forward=await post('/api/tasks/transition',{id:task.id,action:'forward'},vice);assert.equal(forward.status,200);assert.equal((await forward.json()).task.trangThai,'Chờ thẩm định');
assert.equal((await post('/api/tasks/transition',{id:task.id,action:'approve'},lead)).status,403);
const rejectedNoReason=await post('/api/tasks/transition',{id:task.id,action:'return',note:'x'},admin);assert.equal(rejectedNoReason.status,400);
const returned=await post('/api/tasks/transition',{id:task.id,action:'return',note:'Bổ sung căn cứ văn bản'},admin);assert.equal(returned.status,200);
for(const c of [lead,vice,staff]){const d=await (await req('/api/data','GET',null,c)).json();assert.equal(d.tasks[0].trangThai,'Yêu cầu chỉnh sửa');assert.equal(d.tasks[0].lyDoTraLai,'Bổ sung căn cứ văn bản')}
assert.equal((await post('/api/tasks/transition',{id:task.id,action:'forward'},vice)).status,403);
const edit=await post('/api/tasks',{task:{id:task.id,soVBBanHanh:'123/QĐ',ngayHoanThanh:'2026-10-30'}},staff);assert.equal(edit.status,200);assert.equal((await edit.json()).task.trangThai,'Yêu cầu chỉnh sửa');
const resubmit=await post('/api/tasks/transition',{id:task.id,action:'resubmit',note:'Đã điều chỉnh số liệu và phụ lục'},staff);assert.equal(resubmit.status,200);assert.equal((await resubmit.json()).task.trangThai,'Đã gửi');
assert.equal((await post('/api/tasks/transition',{id:task.id,action:'approve'},admin)).status,403);
assert.equal((await post('/api/tasks/transition',{id:task.id,action:'forward'},lead)).status,200);
const approve=await post('/api/tasks/transition',{id:task.id,action:'approve'},admin);assert.equal(approve.status,200);assert.equal((await approve.json()).task.trangThai,'Hoàn thành');
}finally{child.kill();fs.rmSync(dir,{recursive:true,force:true})}
});
