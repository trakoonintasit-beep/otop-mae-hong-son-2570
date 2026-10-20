import { createClient } from 'npm:@supabase/supabase-js@2';

// Only your GitHub Pages origin may invoke this endpoint from a browser.
// Configure OTOP_ALLOWED_ORIGINS for an additional approved domain.
const defaultOrigin = 'https://trakoonintasit-beep.github.io';
const additionalOrigins = (Deno.env.get('OTOP_ALLOWED_ORIGINS') || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = new Set([defaultOrigin, ...additionalOrigins]);
const usernameSuffix = '@accounts.otop-admin.example.com';
const usernameRe = /^[a-z][a-z0-9_.-]{3,23}$/;
const userIdRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Input = {
  action?: unknown;
  username?: unknown;
  display_name?: unknown;
  password?: unknown;
  user_id?: unknown;
  is_active?: unknown;
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : defaultOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: {
      ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    }});

  if (!allowedOrigins.has(origin)) return json({ ok: false, error: 'Origin is not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > 8_192)
    return json({ ok: false, error: 'Payload too large' }, 413);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ ok: false, error: 'Server configuration is incomplete' }, 503);
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401);
    const token = authorization.slice(7);
    const userResult = await service.auth.getUser(token);
    const caller = userResult.data.user;
    if (userResult.error || !caller) return json({ ok: false, error: 'Unauthorized' }, 401);

    // Server-side role verification. UI hiding alone does not grant permission.
    const membership = await service.from('admins')
      .select('role,is_active').eq('user_id', caller.id).maybeSingle();
    if (membership.error) throw membership.error;
    if (membership.data?.role !== 'master_admin' || membership.data?.is_active !== true)
      return json({ ok: false, error: 'เฉพาะ Admin หลักที่มีสิทธิ์ใช้งานเมนูนี้' }, 403);

    let input: Input;
    try { input = await req.json() as Input; }
    catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    if (!input || typeof input !== 'object') return json({ ok: false, error: 'Invalid request' }, 400);

    if (input.action === 'list') {
      const r = await service.from('admins')
        .select('user_id,username,display_name,role,is_active,created_at')
        .eq('role', 'sub_admin').order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return json({ ok: true, accounts: r.data ?? [] });
    }

    if (input.action === 'create') {
      const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
      const display_name = typeof input.display_name === 'string' ? input.display_name.trim() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      if (!usernameRe.test(username)) return json({ ok: false, error: 'Username ต้องขึ้นต้นด้วย a-z ความยาว 4–24 ตัวอักษร' }, 400);
      if (display_name.length < 2 || display_name.length > 100)
        return json({ ok: false, error: 'ชื่อเจ้าหน้าที่ต้องมีความยาว 2–100 ตัวอักษร' }, 400);
      if (!validPassword(password)) return json({ ok: false, error: 'รหัสผ่านต้องมี 12–128 ตัวอักษร มีตัวอักษรและตัวเลข' }, 400);

      const existing = await service.from('admins').select('user_id').eq('username', username).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return json({ ok: false, error: 'Username นี้ถูกใช้แล้ว' }, 409);

      // Internal non-deliverable email: users log in by username only.
      // Password recovery is managed by the master admin, not by email.
      const email = `${username}${usernameSuffix}`;
      const created = await service.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { display_name, username },
      });
      if (created.error || !created.data.user)
        return json({ ok: false, error: 'สร้างบัญชีไม่ได้: Username อาจถูกใช้แล้ว หรือรหัสผ่านไม่ผ่านนโยบาย' }, 409);
      const newId = created.data.user.id;
      const inserted = await service.from('admins').insert({
        user_id: newId, username, display_name, role: 'sub_admin', is_active: true,
        created_by: caller.id,
      });
      if (inserted.error) {
        await service.auth.admin.deleteUser(newId);
        throw inserted.error;
      }
      await service.from('otop_admin_audit').insert({ actor_id: caller.id, target_user_id: newId, action: 'create' });
      return json({ ok: true, account: { user_id: newId, username, display_name, role: 'sub_admin', is_active: true } }, 201);
    }

    if (input.action === 'set_status' || input.action === 'reset_password') {
      const targetId = typeof input.user_id === 'string' ? input.user_id : '';
      if (!userIdRe.test(targetId)) return json({ ok: false, error: 'Invalid user_id' }, 400);
      const target = await service.from('admins')
        .select('user_id,role,username,is_active').eq('user_id',targetId).maybeSingle();
      if (target.error) throw target.error;
      if (!target.data || target.data.role !== 'sub_admin')
        return json({ ok: false, error: 'ไม่พบบัญชี Admin รองที่ต้องการ' }, 404);

      if (input.action === 'set_status') {
        if (typeof input.is_active !== 'boolean') return json({ ok: false, error: 'Invalid status' }, 400);
        const changed = await service.from('admins').update({ is_active: input.is_active }).eq('user_id', targetId).eq('role','sub_admin');
        if (changed.error) throw changed.error;
        await service.from('otop_admin_audit').insert({ actor_id: caller.id, target_user_id: targetId, action: input.is_active ? 'activate' : 'deactivate' });
        return json({ ok: true });
      }
      const password = typeof input.password === 'string' ? input.password : '';
      if (!validPassword(password)) return json({ ok: false, error: 'รหัสผ่านต้องมี 12–128 ตัวอักษร มีตัวอักษรและตัวเลข' }, 400);
      const changed = await service.auth.admin.updateUserById(targetId, { password });
      if (changed.error) throw changed.error;
      await service.from('otop_admin_audit').insert({ actor_id: caller.id, target_user_id: targetId, action: 'reset_password' });
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (error) {
    // Never log credential-bearing request bodies.
    console.error('manage-otop-admins failed', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false, error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ กรุณาตรวจสอบการติดตั้งฐานข้อมูล/ฟังก์ชัน' }, 500);
  }
});

function validPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}
