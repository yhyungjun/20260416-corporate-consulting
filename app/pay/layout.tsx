import PayHeader from '@/components/PayHeader';

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PayHeader />
      {children}
    </>
  );
}
