import { NextResponse } from 'next/server';
import { isLocalSandboxRequest } from '@/server/dev/guard';
import { runOneReviewJob } from '@/server/reviews/worker';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isLocalSandboxRequest(request) || process.env.AI_REVIEW_PROVIDER !== 'stub') return new Response('Not found', { status: 404 });
  await runOneReviewJob();
  return NextResponse.redirect(new URL('/dev?review=processed', request.url), 303);
}
