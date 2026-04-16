'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReport } from '@/context/ReportContext';
import { renderReport } from '@/lib/template-engine';

const A4_W = 800;
const A4_H = 1123;

/** Fetch all /path images in html and replace with base64 data URIs */
async function inlineImages(html: string): Promise<string> {
  const regex = /src="(\/[^"]+\.(png|jpg|jpeg|svg|gif|webp))"/gi;
  const matches = [...html.matchAll(regex)];
  const uniquePaths = [...new Set(matches.map(m => m[1]))];

  const map = new Map<string, string>();
  await Promise.all(
    uniquePaths.map(async (path) => {
      try {
        const res = await fetch(path);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUri: string = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(blob);
        });
        map.set(path, dataUri);
      } catch {
        /* skip */
      }
    }),
  );

  return html.replace(/src="(\/[^"]+\.(png|jpg|jpeg|svg|gif|webp))"/gi, (_match, path: string) => {
    const uri = map.get(path);
    return uri ? `src="${uri}"` : _match;
  });
}

export default function PreviewPage() {
  const router = useRouter();
  const { fields, ready } = useReport();
  const [pageBlobUrls, setPageBlobUrls] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  // printHtml: 전체 페이지를 합친 인쇄용 HTML (window.print PDF용)
  const printHtmlRef = useRef<string>('');

  useEffect(() => {
    if (!ready) return;
    if (!fields) {
      router.replace('/admin/report');
      return;
    }

    async function loadTemplate() {
      // Fetch template + Chart.js source in parallel
      const [htmlRaw, chartJsCode] = await Promise.all([
        fetch('/report.html').then((r) => r.text()),
        fetch('/chart.umd.js').then((r) => r.text()),
      ]);

      const rendered = renderReport(htmlRaw, fields!);

      // Inline all images as base64 (so blob URL has no external deps)
      const inlined = await inlineImages(rendered);

      // Parse
      const parser = new DOMParser();
      const doc = parser.parseFromString(inlined, 'text/html');

      // Extract CSS
      const styleEl = doc.querySelector('style');
      const style = styleEl?.textContent ?? '';

      // Extract chart init code (inline scripts that create Chart instances)
      const chartInitCode = Array.from(doc.querySelectorAll('script'))
        .filter((s) => !s.src && s.textContent?.includes('new Chart'))
        .map((s) => s.textContent ?? '')
        .join('\n');

      // Build self-contained blob URL per page
      const pageElements = doc.querySelectorAll('.page');
      const urls = Array.from(pageElements).map((el) => {
        const blob = new Blob(
          [
            `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{box-sizing:border-box}
body{margin:0;padding:0;background:#fff;width:${A4_W}px}
${style}
</style>
</head>
<body>
${el.outerHTML}
<script>${chartJsCode}</script>
<script>${chartInitCode}</script>
</body>
</html>`,
          ],
          { type: 'text/html' },
        );
        return URL.createObjectURL(blob);
      });

      setPageBlobUrls(urls);

      // 인쇄용 전체 HTML 조립 (window.print → PDF 저장)
      const allPagesHtml = Array.from(pageElements).map((el) => el.outerHTML).join('\n');
      printHtmlRef.current = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>AX Report - ${fields!.companyName || 'report'}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:0;background:#fff}
${style}
@page{size:A4;margin:0}
.page{width:794px;max-width:794px;margin:0;padding:0;border-radius:0!important;box-shadow:none!important;page-break-after:always;page-break-inside:avoid;overflow:hidden}
.page:last-child{page-break-after:auto}
.cover{min-height:auto}.ending{min-height:auto}
</style>
</head>
<body>
${allPagesHtml}
<script>${chartJsCode}</script>
<script>${chartInitCode}</script>
</body>
</html>`;
    }

    loadTemplate();
  }, [fields, router]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      pageBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pageBlobUrls]);

  // Responsive scale
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setScale(Math.min(containerRef.current.clientWidth / A4_W, 1));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pageBlobUrls]);

  const goTo = useCallback(
    (page: number) => setCurrentPage(Math.max(0, Math.min(page, pageBlobUrls.length - 1))),
    [pageBlobUrls.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(currentPage - 1);
      if (e.key === 'ArrowRight') goTo(currentPage + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, goTo]);

  // 브라우저 인쇄 → PDF 저장 (Vercel serverless에서 Chromium 사용 불가하므로 클라이언트 방식)
  const downloadPdf = () => {
    if (!fields || !printHtmlRef.current) return;
    setPdfLoading(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업이 차단됐습니다. 주소창 오른쪽의 팝업 허용 버튼을 클릭한 후 다시 시도해주세요.');
      setPdfLoading(false);
      return;
    }

    printWindow.document.write(printHtmlRef.current);
    printWindow.document.close();

    const doPrint = () => {
      printWindow.focus();
      printWindow.print();
      setPdfLoading(false);
    };

    // Chart.js 렌더링 + 폰트/이미지 로드 완료 후 인쇄
    if (printWindow.document.readyState === 'complete') {
      setTimeout(doPrint, 800);
    } else {
      printWindow.onload = () => setTimeout(doPrint, 800);
    }
  };

  if (pageBlobUrls.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-50">
        <div className="h-1 bg-gray-800" />
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => router.push('/admin/report/review')}
              className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-sm"
            >
              ← 뒤로
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>1. 노트 입력</span>
              <span>→</span>
              <span>2. 리뷰</span>
              <span>→</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">
                3. 미리보기
              </span>
            </div>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="py-2 px-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm flex items-center gap-2"
            >
              {pdfLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  생성 중...
                </>
              ) : (
                'PDF 다운로드 →'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Slide viewer */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div
          className="absolute left-0 top-0 h-full cursor-pointer z-10"
          style={{ width: `calc(50% - ${(A4_W * scale) / 2}px)` }}
          onClick={() => goTo(currentPage - 1)}
        />
        <div
          className="absolute right-0 top-0 h-full cursor-pointer z-10"
          style={{ width: `calc(50% - ${(A4_W * scale) / 2}px)` }}
          onClick={() => goTo(currentPage + 1)}
        />

        <div ref={containerRef} className="w-full max-w-4xl">
          <div
            className="bg-white rounded-lg shadow-2xl overflow-hidden mx-auto"
            style={{ width: `${A4_W * scale}px`, height: `${A4_H * scale}px` }}
          >
            <div
              style={{
                width: `${A4_W}px`,
                height: `${A4_H}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                key={pageBlobUrls[currentPage]}
                src={pageBlobUrls[currentPage]}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={`report-page-${currentPage + 1}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Page indicator */}
      <div className="flex items-center justify-center gap-2 pb-6">
        <div className="flex items-center gap-1.5">
          {pageBlobUrls.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === currentPage ? 'w-6 h-3 bg-purple-500' : 'w-3 h-3 bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-2">
          {currentPage + 1} / {pageBlobUrls.length}
        </span>
      </div>
    </div>
  );
}
