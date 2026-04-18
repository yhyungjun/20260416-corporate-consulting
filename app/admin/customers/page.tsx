import Link from 'next/link';
import { listPipelines } from '@/lib/apphub/apphub-pipelines';
import { listPayments } from '@/lib/apphub/apphub-payments';
import { listQuestionnaires } from '@/lib/apphub/apphub-questionnaires';

export default async function CustomersPage() {
  const [pipelines, payments, questionnaires] = await Promise.all([
    listPipelines(),
    listPayments(),
    listQuestionnaires(),
  ]);

  // 파이프라인 기준으로 데이터 조인
  const customers = pipelines.map((pipeline) => {
    const payment = payments.find((p) => p.id === pipeline.payment_id);
    const questionnaire = questionnaires.find(
      (q) => q.pipeline_token === pipeline.questionnaire_token,
    );

    return {
      pipelineId: pipeline.id,
      companyName: pipeline.company_name,
      contactName: pipeline.contact_name || '-',
      contactEmail: pipeline.contact_email,
      paymentStatus: payment?.status || 'UNKNOWN',
      questionnaireStatus: questionnaire?.status || 'NOT_STARTED',
      submittedAt: questionnaire?.submitted_at,
      createdAt: pipeline.created_at,
    };
  });

  // 최신순 정렬
  customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      CONFIRMED: { text: '결제완료', color: 'bg-green-100 text-green-700' },
      PENDING: { text: '대기중', color: 'bg-yellow-100 text-yellow-700' },
      FAILED: { text: '실패', color: 'bg-red-100 text-red-700' },
      SUBMITTED: { text: '제출완료', color: 'bg-blue-100 text-blue-700' },
      IN_PROGRESS: { text: '작성중', color: 'bg-yellow-100 text-yellow-700' },
      NOT_STARTED: { text: '미시작', color: 'bg-gray-100 text-gray-500' },
    };
    const info = map[status] || { text: status, color: 'bg-gray-100 text-gray-500' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
        {info.text}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">고객 응답 관리</h1>
      <p className="text-gray-500 mb-6">총 {customers.length}건</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">회사명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">담당자</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">이메일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">결제</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">설문</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">제출일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c) => (
              <tr key={c.pipelineId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
                <td className="px-4 py-3 text-gray-600">{c.contactName}</td>
                <td className="px-4 py-3 text-gray-600">{c.contactEmail}</td>
                <td className="px-4 py-3">{statusLabel(c.paymentStatus)}</td>
                <td className="px-4 py-3">{statusLabel(c.questionnaireStatus)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('ko-KR') : '-'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/customers/${c.pipelineId}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  아직 고객 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
