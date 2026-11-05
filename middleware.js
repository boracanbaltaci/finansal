// Vercel Routing Middleware: siteyi şifreyle korur.
// Şifre Vercel'de APP_PASSWORD ortam değişkeninde tutulur (kodda yok).
// Doğru şifre girilince 1 yıllık, HttpOnly bir çerez verilir.

export const config = {
  // İkonlar ve manifest herkese açık kalabilir (ana ekrana ekleme için); geri kalan her şey korumalı
  matcher: ['/((?!icons/|manifest\\.webmanifest).*)'],
};

const COOKIE = 'fin_auth';
const YEAR = 60 * 60 * 24 * 365;

async function tokenFor(password) {
  const data = new TextEncoder().encode('finansal-auth:' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export default async function middleware(req) {
  const password = process.env.APP_PASSWORD;
  if (!password) return html(loginPage('Sunucuda şifre ayarlanmamış (APP_PASSWORD).'), 500);

  const url = new URL(req.url);
  const expected = await tokenFor(password);

  if (url.pathname === '/login' && req.method === 'POST') {
    const form = await req.formData();
    if (form.get('password') === password) {
      return new Response(null, {
        status: 303,
        headers: { Location: '/', 'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    return html(loginPage('Şifre yanlış, tekrar dene.'), 401);
  }

  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  if (readCookie(req, COOKIE) === expected) return; // giriş yapılmış → isteğe devam

  return html(loginPage(''), 401);
}

function loginPage(error) {
  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Finansal">
<meta name="theme-color" content="#0b0d10">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<title>Finansal · Giriş</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px;
    background: radial-gradient(120% 80% at 50% 0%, #2a1f6b 0%, #0b0d10 60%); color: #f2f4f7;
    font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  form { width: 100%; max-width: 360px; display: grid; gap: 14px; text-align: center; }
  img { width: 76px; height: 76px; border-radius: 20px; margin: 0 auto 6px; box-shadow: 0 14px 34px -10px rgba(109,94,252,.8); }
  h1 { margin: 0; font-size: 26px; font-weight: 800; }
  p { margin: 0 0 8px; color: #8b94a3; font-size: 14px; }
  input { width: 100%; height: 54px; padding: 0 16px; border-radius: 16px; border: 1.5px solid rgba(255,255,255,.1);
    background: #15181d; color: inherit; font-size: 17px; outline: 0; }
  input:focus { border-color: #8a7dff; }
  button { height: 54px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, #6d5efc, #a855f7); box-shadow: 0 10px 24px -8px rgba(109,94,252,.8); }
  .err { color: #fb7185; font-size: 14px; font-weight: 600; min-height: 1em; }
</style>
</head><body>
<form method="post" action="/login">
  <img src="/icons/icon-192.png" alt="">
  <h1>Finansal</h1>
  <p>Devam etmek için şifreni gir</p>
  <input type="password" name="password" autocomplete="current-password" placeholder="Şifre" autofocus required>
  <div class="err">${error}</div>
  <button type="submit">Giriş yap</button>
</form>
</body></html>`;
}
