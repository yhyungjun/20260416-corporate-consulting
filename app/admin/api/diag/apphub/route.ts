import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listQuestionnaires } from '@/lib/apphub/apphub-questionnaires';
import { listPipelines } from '@/lib/apphub/apphub-pipelines';
import { listPayments } from '@/lib/apphub/apphub-payments';

// [TEMPORARY DIAGNOSTIC — REMOVE AFTER VERIFICATION]
// Probes AppHub connectivity from production. Returns only counts + schema
// shape (no PII, no answer data, no emails/company names).

type ProbeResult =
  | { table: string; ok: true; rowCount: number; sampleKeys: string[]; elapsedMs: number }
  | { table: string; ok: false; error: string; elapsedMs: number };

async function probe<T extends object>(
  table: string,
  fn: () => Promise<T[]>,
): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const rows = await fn();
    return {
      table,
      ok: true,
      rowCount: rows.length,
      sampleKeys: rows[0] ? Object.keys(rows[0]).sort() : [],
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      table,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - t0,
    };
  }
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email?.endsWith('@jocodingax.ai')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const results = await Promise.all([
    probe('questionnaires', listQuestionnaires),
    probe('pipelines', listPipelines),
    probe('payments', listPayments),
  ]);

  return NextResponse.json({
    env: {
      apiUrl: process.env.APPHUB_API_URL ?? '(unset)',
      dbSchema: process.env.APPHUB_DB_SCHEMA ?? '(unset)',
      apiKeyPresent: Boolean(process.env.APPHUB_API_KEY || process.env.APPHUB_APP_KEY),
      apiKeyLen:
        (process.env.APPHUB_API_KEY || process.env.APPHUB_APP_KEY || '').length,
    },
    results,
    timestamp: new Date().toISOString(),
  });
}
