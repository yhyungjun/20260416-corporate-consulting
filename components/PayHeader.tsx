import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import UserMenu from '@/components/UserMenu';

export default async function PayHeader() {
  const session = await auth();
  const user = session?.user
    ? { ...session.user, role: (session.user as { role?: string }).role }
    : null;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/">
            <Image src="/images/logo.png" alt="조코딩 AX 파트너스" width={160} height={40} className="h-8 w-auto" />
          </Link>
          <p className="text-sm text-gray-500 mt-1">사전 기업 진단 컨설팅</p>
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
