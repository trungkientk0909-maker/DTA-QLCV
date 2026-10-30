'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname, DATA = process.env.DATA_DIR || path.join(ROOT,'data');
const DB = path.join(DATA,'database.json'), PORT = Number(process.env.PORT||3000);
const COOKIE = 'dta_session';
fs.mkdirSync(DATA,{recursive:true});
const initial = {users:[],tasks:[],departments:[],assignees:[]};
function persist(db){const tmp=DB+'.'+process.pid+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,DB)}
let db = fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):initial;
db.departments ||= [...new Set([...(db.assignees||[]).map(a=>a.department),...db.users.map(u=>u.department)].filter(d=>d && d!=='Tất cả'))];
const hash = pass=>{let salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(pass,salt,64).toString('hex')};
function verify(pass,stored){try{const [salt,digest]=stored.split(':');return crypto.timingSafeEqual(crypto.scryptSync(pass,salt,64),Buffer.from(digest,'hex'))}catch{return false}}
if(!db.users.length){ const username=process.env.ADMIN_USER||'admin';const password=process.env.ADMIN_PASSWORD;
  if(!password || password.length<12){console.error('Cần đặt ADMIN_PASSWORD ít nhất 12 ký tự khi khởi tạo.');process.exit(1)}
  db.users.push({username:username.toLowerCase(),passwordHash:hash(password),fullName:'Quản trị hệ thống',department:'Tất cả',role:'Admin',requireChange:true});persist(db);
  console.log('Đã khởi tạo tài khoản quản trị. Hãy đổi mật khẩu sau khi đăng nhập.');
}
const sessions=new Map(), attempts=new Map();
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function cookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
function who(req){let session=sessions.get(cookie(req));if(!session||session.expires<Date.now()){return null}session.expires=Date.now()+8*3600e3;return db.users.find(x=>x.username===session.username)||null}
const publicUser=u=>({username:u.username,fullName:u.fullName,department:u.department,role:u.role});
const isGlobal=u=>u.role==='Admin' && u.department==='Tất cả';
const isLeader=u=>u.role==='Trưởng phòng'||u.role==='Phó phòng'||(u.role==='Admin'&&u.department!=='Tất cả');
const isDeptAdmin=u=>isGlobal(u)||isLeader(u);
const sameDept=(u,t)=>t.cqPhuTrach===u.department;
const isDeptTask=t=>!t.assigneeUsername&&!String(t.nguoi||'').trim();
// Tách biệt theo tài khoản; không lấy mọi nhiệm vụ của cùng phòng ban.
function taskOwner(t){
  if(t.assigneeUsername)return t.assigneeUsername;
  // Nhiệm vụ cũ: chỉ gắn theo tên khi tìm được đúng MỘT tài khoản trong phòng.
  const candidates=db.users.filter(u=>u.role==='User'&&u.department===t.cqPhuTrach&&u.fullName===t.nguoi);
  return candidates.length===1?candidates[0].username:null;
}
const canView=(u,t)=>isGlobal(u)||(isLeader(u)&&sameDept(u,t))||(u.role==='User'&&taskOwner(t)===u.username);


function authorizedData(user){const depts={};for(const a of db.assignees){if(isGlobal(user)||a.department===user.department){(depts[a.department]??=[]).push(a.name)}}
  const tasks=db.tasks.filter(t=>canView(user,t)).map(t=>({...t,trangThai:computed(t)}));return {departments:depts,tasks};}
function computed(t){if(['Hoàn thành','Chờ thẩm định','Yêu cầu chỉnh sửa'].includes(t.trangThai)||!t.han)return t.trangThai||'Đang xử lý';const diff=new Date(t.han+'T23:59:59').getTime()-Date.now();return !Number.isFinite(diff)?(t.trangThai||'Đang xử lý'):diff<0?'Quá hạn':diff<=12*3600e3?'Sắp hết hạn 12 giờ':diff<=24*3600e3?'Sắp hết hạn 24 giờ':(t.trangThai||'Đang xử lý')}
const fields=['soVB','coQuan','ten','cqPhuTrach','nguoi','ngayGiao','han','ngayHoanThanh','trangThai','nhomCongViec','chamDiem','danhGiaBaoCao','soVBBanHanh'];
async function readJson(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>1024*1024)throw Error('Dữ liệu quá lớn');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('JSON không hợp lệ')}}
function checkOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host}catch{return false}}
function setSession(res,user){let sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,{username:user.username,expires:Date.now()+8*3600e3});res.setHeader('Set-Cookie',`${COOKIE}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`)}
async function api(req,res,url){if(req.method==='POST'&&!checkOrigin(req))return send(res,403,{success:false,msg:'Nguồn yêu cầu không hợp lệ'});
  const body=req.method==='POST'?await readJson(req):{};const user=who(req);
  if(url.pathname==='/api/login'&&req.method==='POST'){
    const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');const key=req.socket.remoteAddress+':'+username;
    let a=attempts.get(key)||{count:0,until:0};if(a.until>Date.now())return send(res,429,{success:false,msg:'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.'});
    const found=db.users.find(u=>u.username===username);
    if(!found||!verify(password,found.passwordHash)){a.count++;if(a.count>=8){a.until=Date.now()+15*60e3;a.count=0}attempts.set(key,a);return send(res,401,{success:false,msg:'Tài khoản hoặc mật khẩu không đúng'});}attempts.delete(key);setSession(res,found);return send(res,200,{success:true,user:publicUser(found),requireChange:found.requireChange});
  }
  if(url.pathname==='/api/logout'&&req.method==='POST'){sessions.delete(cookie(req));res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);return send(res,200,{success:true})}
  if(!user)return send(res,401,{success:false,msg:'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'});
  if(url.pathname==='/api/change-password'&&req.method==='POST'){
    const pass=String(body.newPassword||'');if(pass.length<10||pass.length>128)return send(res,400,{success:false,msg:'Mật khẩu phải từ 10 đến 128 ký tự'});
    if(!user.requireChange && !verify(String(body.currentPassword||''),user.passwordHash))return send(res,403,{success:false,msg:'Mật khẩu hiện tại không đúng'});
    user.passwordHash=hash(pass);user.requireChange=false;persist(db);sessions.delete(cookie(req));return send(res,200,{success:true});
  }
  if(user.requireChange)return send(res,403,{success:false,msg:'Bạn phải đổi mật khẩu trước khi sử dụng hệ thống'});
  if(url.pathname==='/api/data'&&req.method==='GET')return send(res,200,authorizedData(user));
  if(url.pathname==='/api/tasks'&&req.method==='POST'){
    const raw=body.task||{},existing=db.tasks.find(t=>t.id===String(raw.id||''));
    if(!existing && !isDeptAdmin(user))return send(res,403,{success:false,msg:'Chỉ quản trị hoặc lãnh đạo phòng được tạo công việc'});
    if(existing && !canView(user,existing))return send(res,403,{success:false,msg:'Không có quyền đối với nhiệm vụ này'});
    if(existing && !isDeptAdmin(user) && (taskOwner(existing)!==user.username || ['Hoàn thành','Chờ thẩm định'].includes(existing.trangThai)))return send(res,403,{success:false,msg:'Không được sửa công việc này'});
    let t=existing?{...existing}:{id:crypto.randomUUID()};
    if(isDeptAdmin(user)){
      for(const f of fields)t[f]=String(raw[f]??'').slice(0,2000);
      if(!isGlobal(user)&&t.cqPhuTrach!==user.department)return send(res,403,{success:false,msg:'Không thể chuyển nhiệm vụ sang phòng ban khác'});
      if(!db.departments.includes(t.cqPhuTrach))return send(res,400,{success:false,msg:'Phòng ban chưa được tạo'});
      if(!String(t.nguoi||'').trim()){
        // Nhiệm vụ giao cho phòng ban: lãnh đạo phòng xem, sau đó có thể phân công cá nhân.
        t.nguoi='';t.assigneeUsername=null;
      }else{
        const assigned=db.users.filter(u=>u.department===t.cqPhuTrach&&u.fullName===t.nguoi);
        if(assigned.length!==1)return send(res,400,{success:false,msg:'Người nhận phải có đúng một tài khoản trong phòng ban. Hoặc để trống để giao trực tiếp cho phòng ban.'});
        t.assigneeUsername=assigned[0].username;
      }

    }else{
      for(const f of ['ngayHoanThanh','soVBBanHanh'])t[f]=String(raw[f]??'').slice(0,2000);
      t.trangThai=t.ngayHoanThanh||t.soVBBanHanh?'Chờ thẩm định':'Đang xử lý';
    }
    if(!t.ten||!t.cqPhuTrach)return send(res,400,{success:false,msg:'Thiếu tên công việc hoặc cơ quan phụ trách'});
    if(t.chamDiem && (!/^\d+(\.\d+)?$/.test(t.chamDiem)||Number(t.chamDiem)>500))return send(res,400,{success:false,msg:'Điểm không hợp lệ'});
    if(existing)Object.assign(existing,t);else db.tasks.unshift(t);persist(db);return send(res,200,{success:true,task:t});
  }
  if(url.pathname==='/api/tasks/delete'&&req.method==='POST'){
    if(!isDeptAdmin(user))return send(res,403,{success:false,msg:'Chỉ quản trị được xóa công việc'});
    const idx=db.tasks.findIndex(t=>t.id===String(body.id||''));if(idx<0)return send(res,404,{success:false,msg:'Không tìm thấy công việc'});
    if(!canView(user,db.tasks[idx]))return send(res,403,{success:false,msg:'Không có quyền'});
    db.tasks.splice(idx,1);persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/departments'&&req.method==='GET'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ Admin toàn hệ thống'});
    return send(res,200,{success:true,departments:db.departments});
  }
  if(url.pathname==='/api/admin/departments'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ Admin toàn hệ thống'});
    const name=String(body.name||'').trim();
    if(name.length<2||name.length>120)return send(res,400,{success:false,msg:'Tên phòng ban phải từ 2 đến 120 ký tự'});
    if(name==='Tất cả'||db.departments.some(d=>d.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))return send(res,409,{success:false,msg:'Phòng ban đã tồn tại hoặc tên không hợp lệ'});
    db.departments.push(name);persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/users'&&req.method==='GET'){
    if(!isGlobal(user))return send(res,403,{msg:'Không có quyền'});
    return send(res,200,{users:db.users.map(u=>({...publicUser(u),requireChange:u.requireChange}))});
  }
  if(url.pathname==='/api/admin/users'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{msg:'Không có quyền'});
    const username=String(body.username||'').trim().toLowerCase(),pass=String(body.password||'');
    if(!/^[a-z0-9_.-]{3,40}$/.test(username)||db.users.some(u=>u.username===username)||pass.length<10)return send(res,400,{msg:'Tên tài khoản trùng/không hợp lệ hoặc mật khẩu dưới 10 ký tự'});
    const u={username,passwordHash:hash(pass),fullName:String(body.fullName||username).slice(0,120),department:String(body.department||'').slice(0,120),role:['Admin','Trưởng phòng','Phó phòng','User'].includes(body.role)?body.role:'User',requireChange:true};
    if(u.department==='Tất cả' && u.role!=='Admin')return send(res,400,{msg:'Tài khoản User phải thuộc phòng ban cụ thể'});
    if(u.department!=='Tất cả'&&!db.departments.includes(u.department))return send(res,400,{msg:'Phòng ban chưa được tạo'});
    if(db.users.some(x=>x.department===u.department&&x.fullName===u.fullName))return send(res,400,{msg:'Trong một phòng ban, mỗi tài khoản User phải có họ tên khác nhau để phân công chính xác'});
    db.users.push(u);
    if(!db.assignees.some(a=>a.department===u.department&&a.name===u.fullName))db.assignees.push({department:u.department,name:u.fullName});
    // Định danh lại nhiệm vụ cũ trùng đúng người/phòng ban chưa có tài khoản nhận.
    for(const t of db.tasks){if(!t.assigneeUsername&&t.nguoi&&t.cqPhuTrach===u.department&&t.nguoi===u.fullName)t.assigneeUsername=u.username;}
    persist(db);return send(res,200,{success:true});
  }
  // Chỉnh sửa tài khoản: tên đăng nhập là định danh bất biến để không làm mất liên kết công việc.
  if(url.pathname==='/api/admin/users/update'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị toàn hệ thống'});
    const username=String(body.username||'').toLowerCase().trim();
    const target=db.users.find(u=>u.username===username);
    if(!target)return send(res,404,{success:false,msg:'Không tìm thấy tài khoản'});
    const department=String(body.department||'').trim();
    const fullName=String(body.fullName||'').trim();
    const role=String(body.role||'');
    if(!fullName||fullName.length>120||!['Admin','Trưởng phòng','Phó phòng','User'].includes(role))return send(res,400,{success:false,msg:'Họ tên hoặc vai trò không hợp lệ'});
    if(department!=='Tất cả'&&!db.departments.includes(department))return send(res,400,{success:false,msg:'Phòng ban không tồn tại'});
    if(department==='Tất cả'&&role!=='Admin')return send(res,400,{success:false,msg:'Chỉ Admin hệ thống được thuộc Tất cả'});
    if(username===user.username&&(role!=='Admin'||department!=='Tất cả'))return send(res,400,{success:false,msg:'Không thể tự hạ quyền tài khoản quản trị đang đăng nhập'});
    if(db.users.some(u=>u!==target&&u.department===department&&u.fullName===fullName))return send(res,409,{success:false,msg:'Đã có người trùng họ tên trong phòng ban'});
    // Chỉ cho sửa phòng ban nếu người này chưa có nhiệm vụ được giao.
    if(target.department!==department&&db.tasks.some(t=>t.assigneeUsername===username))return send(res,409,{success:false,msg:'Tài khoản còn nhiệm vụ đã giao. Hãy chuyển giao công việc trước khi đổi phòng ban'});
    const oldName=target.fullName,oldDept=target.department;
    target.fullName=fullName;target.department=department;target.role=role;
    for(const t of db.tasks){if(t.assigneeUsername===username)t.nguoi=fullName;}
    db.assignees=db.assignees.filter(a=>!(a.department===oldDept&&a.name===oldName));
    if(department!=='Tất cả'&&!db.assignees.some(a=>a.department===department&&a.name===fullName))db.assignees.push({department,name:fullName});
    for(const [sid,sess] of sessions){if(sess.username===username&&username!==user.username)sessions.delete(sid)}
    persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/users/delete'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị toàn hệ thống'});
    const username=String(body.username||'').trim().toLowerCase();
    const target=db.users.find(u=>u.username===username);
    if(!target)return send(res,404,{success:false,msg:'Không tìm thấy tài khoản'});
    if(username===user.username)return send(res,403,{success:false,msg:'Không được xóa tài khoản đang đăng nhập'});
    if(db.tasks.some(t=>t.assigneeUsername===username))return send(res,409,{success:false,msg:'Người dùng còn công việc được giao. Hãy chuyển giao hoặc thu hồi các nhiệm vụ trước khi xóa tài khoản'});
    db.users=db.users.filter(u=>u.username!==username);
    db.assignees=db.assignees.filter(a=>!(a.department===target.department&&a.name===target.fullName));
    for(const [sid,sess] of sessions){if(sess.username===username)sessions.delete(sid)}
    persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/departments/update'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị toàn hệ thống'});
    const oldName=String(body.oldName||'').trim(),name=String(body.name||'').trim();
    if(!db.departments.includes(oldName))return send(res,404,{success:false,msg:'Không tìm thấy phòng ban'});
    if(name.length<2||name.length>120||name==='Tất cả'||db.departments.some(d=>d!==oldName&&d.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))return send(res,400,{success:false,msg:'Tên phòng ban không hợp lệ hoặc đã tồn tại'});
    db.departments[db.departments.indexOf(oldName)]=name;
    db.users.forEach(u=>{if(u.department===oldName)u.department=name});
    db.assignees.forEach(a=>{if(a.department===oldName)a.department=name});
    db.tasks.forEach(t=>{if(t.cqPhuTrach===oldName)t.cqPhuTrach=name});
    persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/departments/delete'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị toàn hệ thống'});
    const name=String(body.name||'').trim();
    if(!db.departments.includes(name))return send(res,404,{success:false,msg:'Không tìm thấy phòng ban'});
    if(db.tasks.some(t=>t.cqPhuTrach===name)||db.users.some(u=>u.department===name))return send(res,409,{success:false,msg:'Phòng ban còn tài khoản hoặc công việc. Hãy xử lý dữ liệu trước khi xóa'});
    db.departments=db.departments.filter(d=>d!==name);
    db.assignees=db.assignees.filter(a=>a.department!==name);
    persist(db);return send(res,200,{success:true});
  }
  // Đặt lại mật khẩu: chỉ quản trị toàn hệ thống, không làm mất phiên Admin.
  if(url.pathname==='/api/admin/users/reset-password'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị viên toàn hệ thống được đặt lại mật khẩu'});
    const username=String(body.username||'').trim().toLowerCase(),pass=String(body.newPassword||'');
    if(pass.length<10||pass.length>128)return send(res,400,{success:false,msg:'Mật khẩu mới phải dài từ 10 đến 128 ký tự'});
    const target=db.users.find(u=>u.username===username);
    if(!target)return send(res,404,{success:false,msg:'Không tìm thấy tài khoản'});
    if(target.username===user.username)return send(res,403,{success:false,msg:'Để đổi mật khẩu của chính mình, hãy sử dụng chức năng đổi mật khẩu cá nhân'});
    target.passwordHash=hash(pass);target.requireChange=true;
    for(const [sid,session] of sessions){if(session.username===target.username)sessions.delete(sid)}
    attempts.forEach((value,key)=>{if(key.endsWith(':'+target.username))attempts.delete(key)});
    persist(db);return send(res,200,{success:true,msg:'Đã đặt lại mật khẩu. Người dùng phải đổi mật khẩu khi đăng nhập lần tới.'});
  }
  if(url.pathname==='/api/admin/assignees'&&req.method==='GET'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị hệ thống'});
    return send(res,200,{success:true,assignees:db.assignees});
  }
  if(url.pathname==='/api/admin/assignees/update'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị hệ thống'});
    const oldName=String(body.oldName||'').trim(),oldDepartment=String(body.oldDepartment||'').trim();
    const name=String(body.name||'').trim(),department=String(body.department||'').trim();
    const item=db.assignees.find(a=>a.department===oldDepartment&&a.name===oldName);
    if(!item)return send(res,404,{success:false,msg:'Không tìm thấy nhân sự'});
    if(!name||name.length>120||!db.departments.includes(department))return send(res,400,{success:false,msg:'Thông tin nhân sự không hợp lệ'});
    if(db.users.some(u=>u.department===oldDepartment&&u.fullName===oldName))return send(res,409,{success:false,msg:'Nhân sự này đã có tài khoản. Hãy dùng nút Sửa tài khoản'});
    if(db.tasks.some(t=>t.cqPhuTrach===oldDepartment&&t.nguoi===oldName))return send(res,409,{success:false,msg:'Nhân sự đang có công việc. Hãy điều chỉnh phân công trước khi sửa'});
    if(db.assignees.some(a=>a!==item&&a.department===department&&a.name===name))return send(res,409,{success:false,msg:'Nhân sự đã tồn tại'});
    item.name=name;item.department=department;persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/assignees/delete'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{success:false,msg:'Chỉ quản trị hệ thống'});
    const name=String(body.name||'').trim(),department=String(body.department||'').trim();
    if(!db.assignees.some(a=>a.name===name&&a.department===department))return send(res,404,{success:false,msg:'Không tìm thấy nhân sự'});
    if(db.users.some(u=>u.department===department&&u.fullName===name))return send(res,409,{success:false,msg:'Nhân sự này đã có tài khoản. Hãy dùng chức năng xóa tài khoản'});
    if(db.tasks.some(t=>t.cqPhuTrach===department&&t.nguoi===name))return send(res,409,{success:false,msg:'Nhân sự đang có nhiệm vụ, không thể xóa'});
    db.assignees=db.assignees.filter(a=>!(a.name===name&&a.department===department));persist(db);return send(res,200,{success:true});
  }
  if(url.pathname==='/api/admin/assignees'&&req.method==='POST'){
    if(!isGlobal(user))return send(res,403,{msg:'Không có quyền'});
    const department=String(body.department||'').trim(),name=String(body.name||'').trim();if(!db.departments.includes(department))return send(res,400,{msg:'Phòng ban chưa được tạo'});if(!department||!name)return send(res,400,{msg:'Thiếu phòng ban/nhân sự'});
    if(!db.assignees.some(a=>a.department===department&&a.name===name))db.assignees.push({department:department.slice(0,120),name:name.slice(0,120)});persist(db);return send(res,200,{success:true});
  }
  return send(res,404,{success:false,msg:'Không tìm thấy API'});
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
  if(url.pathname.startsWith('/api/'))return await api(req,res,url);
  if(req.method!=='GET')return send(res,405,{msg:'Không hỗ trợ'});
  const requested=url.pathname==='/'?'/index.html':url.pathname;const base=path.join(ROOT,'public');const p=path.resolve(base,'.'+requested);
  if(!p.startsWith(base+path.sep))return send(res,403,{msg:'Không hợp lệ'});
  fs.readFile(p,(err,data)=>{if(err)return send(res,404,{msg:'Không tìm thấy'});res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data)});
}catch(err){console.error(err);send(res,400,{success:false,msg:err.message||'Có lỗi xảy ra'})}}).listen(PORT,'0.0.0.0',()=>console.log(`DTA chạy tại http://localhost:${PORT}`));
