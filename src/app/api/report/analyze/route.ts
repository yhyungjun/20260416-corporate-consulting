import { analyzeMeetingNotesStream } from '@/lib/claude-prompt';
import type { ReportFields } from '@/lib/report-schema';

export const maxDuration = 120;

function writeLine(controller: ReadableStreamDefaultController, obj: object) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'));
}

export async function POST(request: Request) {
  let meetingNotes: string;
  let surveyFields: Partial<ReportFields> | null;

  try {
    const body = await request.json();
    meetingNotes = body.meetingNotes;
    surveyFields = body.surveyFields || null;
  } catch {
    return new Response(
      JSON.stringify({ type: 'error', message: '잘못된 요청입니다.' }) + '\n',
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } },
    );
  }

  if (!meetingNotes || typeof meetingNotes !== 'string') {
    return new Response(
      JSON.stringify({ type: 'error', message: '미팅 노트를 입력해주세요.' }) + '\n',
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } },
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      (async () => {
        try {
          const result = await analyzeMeetingNotesStream(meetingNotes, (message) => {
            writeLine(controller, { type: 'progress', message });
          });

          // 설문 직접 매핑 필드 머지
          if (surveyFields && typeof surveyFields === 'object') {
            const surveyKeys = Object.keys(surveyFields) as (keyof ReportFields)[];
            for (const key of surveyKeys) {
              const sv = surveyFields[key];
              if (sv != null) {
                (result.fields as unknown as Record<string, unknown>)[key] = sv;
                result.metadata.lowConfidenceFields = result.metadata.lowConfidenceFields.filter(
                  (f: string) => f !== key,
                );
              }
            }
            const fieldKeys = Object.keys(result.fields) as (keyof ReportFields)[];
            result.metadata.fieldsExtracted = fieldKeys.filter((k) => result.fields[k] != null).length;
            result.metadata.fieldsMissing = fieldKeys.length - result.metadata.fieldsExtracted;
          }

          writeLine(controller, { type: 'result', data: result });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error('Analyze error:', msg);
          writeLine(controller, { type: 'error', message: `분석 중 오류: ${msg}` });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
