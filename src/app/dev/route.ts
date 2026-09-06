import { isLocalSandboxRequest } from '@/server/dev/guard';

export async function GET(request: Request) {
  if (!isLocalSandboxRequest(request)) return new Response('Not found', { status: 404 });
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arena local sandbox</title>
<style>body{font:18px/1.6 system-ui;max-width:760px;margin:60px auto;padding:24px;color:#17212b;background:#f6f7f9}button,a{font:inherit}button{padding:12px 20px;cursor:pointer}form{display:inline-block;margin:0 12px 16px 0}aside{padding:18px;background:#fff1cb;border-radius:12px}a{color:#2050a0}</style>
<h1>Arena local sandbox</h1><aside><strong>LOCAL FIXTURES — no real accounts, AI grades or payouts.</strong><br>Data stays in the local PostgreSQL database and private MinIO bucket. Email and external webhooks are disabled.</aside>
<h2>Choose a fixture account</h2><p>Each button sets a two-hour HttpOnly participant cookie. The admin fixture uses the normal admin allowlist.</p>
<form method="post" action="/api/dev/session"><button name="role" value="participant">Enter as fixture participant</button></form>
<form method="post" action="/api/dev/session"><button name="role" value="admin">Enter as fixture admin</button></form>
<h2>Try the real application flow</h2><p>Choose a seeded project, enroll, save a submission and request a review. Then process the next queued review below using the existing deterministic <code>stub-dev-v1</code> worker.</p>
<form method="post" action="/api/dev/review"><button>Process one local stub review</button></form>
<p><a href="/app/arena">Arena</a> · <a href="/app/admin">Admin console</a></p>
<p>CV Scanner is disabled until its real provider is configured. Reward catalog prices follow existing seed rules; local redemptions never transfer money. This page and its actions return 404 outside the explicitly enabled localhost sandbox.</p></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
  });
}
