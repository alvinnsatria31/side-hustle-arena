import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { PARTICIPANT_COOKIE } from '@/server/auth/participant-token';
import { provisionParticipant } from '@/server/auth/participant-provision';
import { isLocalSandboxRequest } from '@/server/dev/guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isLocalSandboxRequest(request)) return new Response('Not found', { status: 404 });
  const role = (await request.formData()).get('role');
  if (role !== 'participant' && role !== 'admin') return new Response('Unknown fixture', { status: 400 });
  // Fixed, visibly labeled identities only. No caller-selected subject or role.
  const claims = { sub: `local-sandbox-${role}`, email: `${role}@arena.local.invalid`, username: `local-${role}`, firstName: `LOCAL FIXTURE ${role}` };
  const user = await provisionParticipant(claims);
  if (!user) return new Response('Fixture is inactive', { status: 403 });
  const token = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const response = NextResponse.redirect(new URL(role === 'admin' ? '/app/admin' : '/app/arena', request.url), 303);
  response.cookies.set(PARTICIPANT_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: 7200 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
