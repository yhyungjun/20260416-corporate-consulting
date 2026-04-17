'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    if (isLoggedIn) {
      router.push('/pay');
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-block px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg cursor-pointer"
      >
        시작하기
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 text-center">
            <p className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</p>
            <p className="text-sm text-gray-500 mb-6">서비스 이용을 위해 먼저 로그인해주세요.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => router.push('/login?callbackUrl=/pay')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                로그인하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
