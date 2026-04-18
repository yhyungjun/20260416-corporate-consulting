'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SURVEY_QUESTIONS, QUESTION_PAGES } from '@/lib/questionnaire/question-guide';
import QuestionRenderer from '@/components/questionnaire/QuestionRenderer';
import ProgressBar from '@/components/questionnaire/ProgressBar';
import UserMenu from '@/components/UserMenu';

const EXEC_PARTS = new Set(QUESTION_PAGES.flatMap((p) => p.parts));
const EXEC_QUESTIONS = SURVEY_QUESTIONS.filter((q) => EXEC_PARTS.has(q.part));

function getPageQuestions(pageNum: number) {
  const page = QUESTION_PAGES.find((p) => p.page === pageNum);
  if (!page) return [];
  const partsSet = new Set(page.parts);
  return EXEC_QUESTIONS.filter((q) => partsSet.has(q.part));
}

interface Props {
  pipelineToken: string;
  userEmail: string;
  initialAnswers: Record<string, string>;
  questionnaireId?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  } | null;
  readOnly?: boolean;
}

export default function QuestionnaireClient({ pipelineToken, userEmail, initialAnswers, user, readOnly }: Props) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoSave = useCallback(
    (newAnswers: Record<string, string>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch('/api/questionnaire/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: pipelineToken, userEmail, answers: newAnswers }),
          });
        } catch {
          // 자동 저장 실패는 무시
        }
      }, 2000);
    },
    [pipelineToken, userEmail],
  );

  const handleChange = useCallback(
    (questionId: string, value: string) => {
      if (readOnly) return;
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: value };
        autoSave(next);
        return next;
      });
    },
    [autoSave],
  );

  const handleNext = () => {
    if (currentPage < QUESTION_PAGES.length) {
      setCurrentPage(currentPage + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    // 필수 항목 검증
    const requiredQuestions = EXEC_QUESTIONS.filter((q) => q.required);
    const unanswered = requiredQuestions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      const firstUnanswered = unanswered[0];
      // 해당 페이지로 이동
      const targetPage = QUESTION_PAGES.find((p) => p.parts.includes(firstUnanswered.part));
      if (targetPage && targetPage.page !== currentPage) {
        setCurrentPage(targetPage.page);
        window.scrollTo(0, 0);
      }
      setError(`필수 항목을 모두 작성해주세요. (미작성: ${unanswered.map((q) => q.id).join(', ')})`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await fetch('/api/questionnaire/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pipelineToken, userEmail, answers }),
      });

      const res = await fetch('/api/questionnaire/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pipelineToken, userEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '제출에 실패했습니다.');
      }

      router.push(`/questionnaire/${pipelineToken}/complete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const questions = getPageQuestions(currentPage);
  const pageInfo = QUESTION_PAGES.find((p) => p.page === currentPage)!;
  const isLastPage = currentPage === QUESTION_PAGES.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/">
              <Image src="/images/logo.png" alt="조코딩 AX 파트너스" width={160} height={40} className="h-8 w-auto" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 mt-2">사전 기업 진단 설문</h1>
          </div>
          <UserMenu user={user || null} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {readOnly && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <span className="text-green-500 text-lg">&#10003;</span>
            설문이 제출 완료되었습니다. 응답 내용을 확인할 수 있지만, 수정은 불가합니다.
          </div>
        )}

        <ProgressBar currentPage={currentPage} />

        <div className={`bg-white rounded-xl border border-gray-200 p-6 ${readOnly ? 'opacity-80' : ''}`}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{pageInfo.label}</h2>
            <p className="text-sm text-gray-500 mt-1">{pageInfo.desc}</p>
          </div>

          {questions.map((q) => (
            <QuestionRenderer
              key={q.id}
              question={q}
              value={answers[q.id] || ''}
              onChange={handleChange}
              readOnly={readOnly}
            />
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handlePrev}
            disabled={currentPage === 1}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            이전
          </button>

          {readOnly ? (
            isLastPage ? null : (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                다음
              </button>
            )
          ) : isLastPage ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {submitting ? '제출 중...' : '설문 제출'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              다음
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          {readOnly
            ? '제출 완료된 설문입니다. 내용 확인만 가능합니다.'
            : '답변은 자동으로 저장됩니다. 나중에 다시 로그인하여 이어서 작성할 수 있습니다.'}
        </p>
      </main>
    </div>
  );
}
