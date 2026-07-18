import { PublicWelcomeModal } from './_components/public-welcome-modal'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // JC-045: public auth stays light even when the root theme follows OS dark.
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900"
      style={{ colorScheme: 'light' }}
    >
      <div className="w-full max-w-sm">{children}</div>
      <PublicWelcomeModal />
    </div>
  )
}
