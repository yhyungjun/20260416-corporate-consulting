import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getConfirmedPaymentByEmail } from '@/lib/apphub/apphub-payments';
import { getPipelineByEmail } from '@/lib/apphub/apphub-pipelines';
import { getQuestionnaireByUserEmail, getQuestionnaireByToken } from '@/lib/apphub/apphub-questionnaires';
import QuestionnaireClient from './QuestionnaireClient';

export default async function QuestionnairePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/questionnaire');
  }

  const userEmail = session.user.email;
  const isAdmin = userEmail.endsWith('@jocodingax.ai');

  // 1. 결제 확인 (admin은 API 호출 없이 바로 통과)
  if (!isAdmin) {
    const payment = await getConfirmedPaymentByEmail(userEmail);
    if (!payment) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-sm bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-yellow-500 text-2xl">!</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">결제가 필요합니다</h1>
            <p className="text-gray-500 mb-6">사전 진단 설문은 결제 완료 후 이용할 수 있습니다.</p>
            <Link
              href="/pay"
              className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              결제 페이지로 이동
            </Link>
          </div>
        </div>
      );
    }
  }

  // 2. 파이프라인 조회
  const pipeline = isAdmin ? null : await getPipelineByEmail(userEmail);
  if (!pipeline && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-sm bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">설문 준비 중</h1>
          <p className="text-gray-500">결제가 확인되었으나 설문이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.</p>
        </div>
      </div>
    );
  }

  // 3. 기존 설문 응답 조회 (admin은 빈 상태로 시작)
  let questionnaire = null;
  if (!isAdmin) {
    questionnaire = await getQuestionnaireByUserEmail(userEmail);
    if (!questionnaire && pipeline) {
      questionnaire = await getQuestionnaireByToken(pipeline.questionnaire_token);
    }
  }

  const initialAnswers = questionnaire?.answers || {};
  const pipelineToken = pipeline?.questionnaire_token || 'admin-preview';
  const isSubmitted = questionnaire?.status === 'SUBMITTED';

  const user = session.user
    ? { ...session.user, role: (session.user as { role?: string }).role }
    : null;

  return (
    <QuestionnaireClient
      pipelineToken={pipelineToken}
      userEmail={userEmail}
      initialAnswers={initialAnswers}
      questionnaireId={questionnaire?.id}
      user={user}
      readOnly={isSubmitted}
    />
  );
}
