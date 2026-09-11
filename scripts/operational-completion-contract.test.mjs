import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const whatsappUrl = 'https://wa.me/6285117304579?text=Halo%20Admin%20Sekolah%20Karir,%20saya%20butuh%20bantuan%20terkait%20Side%20Hustle%20Arena';

test('WhatsApp support is global and exposes the exact official contact contract', () => {
  const component = read('src/components/layout/FloatingWhatsApp.tsx');
  const layout = read('src/app/layout.tsx');
  const footer = read('src/components/layout/Footer.tsx');
  const dashboard = read('src/components/arena/ParticipantDashboard.tsx');
  assert.ok(component.includes(whatsappUrl));
  assert.ok(component.includes('#25D366'));
  assert.ok(component.includes('Butuh bantuan? Chat kami di WhatsApp'));
  assert.match(component, /target=["']_blank["']/);
  assert.match(component, /rel=["']noopener noreferrer["']/);
  assert.ok(layout.includes('<FloatingWhatsApp'));
  for (const source of [footer, dashboard]) {
    assert.ok(source.includes('Jika mengalami kendala, hubungi WhatsApp CS:'));
    assert.ok(source.includes('+62 851-1730-4579'));
  }
});

test('live setup docs name the voucher contract and a disabled-first Jobs source', () => {
  const env = read('deploy/env.production.example');
  const guide = read('docs/backend/LIVE_SETUP_GUIDE.md');
  assert.match(env, /^MAIN_SITE_ORIGIN=https:\/\/sekolahkarir\.id$/m);
  assert.match(env, /^MAIN_SITE_VOUCHER_TOKEN=<token_rahasia_voucher>$/m);
  assert.ok(guide.includes('/app/admin/jobs'));
  assert.ok(guide.includes('insert into arena.job_sources'));
  assert.match(guide, /is_active[\s\S]*false/i);
  assert.ok(guide.includes('/app/jobs'));
});
