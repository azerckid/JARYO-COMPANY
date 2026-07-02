function SkeletonLine({ className = '' }: { readonly className?: string }) {
  return <div className={`h-3 rounded-full bg-muted ${className}`} />
}

export default function PayrollLoading() {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="sticky top-0 z-10 border-b border-company-border bg-company-surface px-7 py-3.5">
        <SkeletonLine className="w-24" />
        <SkeletonLine className="mt-2 h-5 w-28" />
      </div>
      <div className="flex w-full max-w-[1280px] flex-col gap-5 px-7 pt-6 pb-12">
        <div className="rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <SkeletonLine className="w-48" />
          <div className="mt-4 grid gap-4 md:grid-cols-6">
            <SkeletonLine className="h-10" />
            <SkeletonLine className="hidden h-10 md:block" />
            <SkeletonLine className="h-10" />
            <SkeletonLine className="hidden h-10 md:block" />
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
          </div>
        </div>

        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4">
          <SkeletonLine className="w-52" />
          <SkeletonLine className="mt-2 w-80 max-w-full" />
        </div>

        <div className="rounded-xl border border-company-border bg-company-surface p-4 shadow-company-card">
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="mt-5 h-4 w-[92%]" />
          <SkeletonLine className="mt-5 h-4 w-[84%]" />
          <SkeletonLine className="mt-5 h-4 w-[76%]" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card">
      <SkeletonLine className="w-24" />
      <SkeletonLine className="mt-4 h-4 w-full" />
      <SkeletonLine className="mt-3 h-4 w-[72%]" />
    </div>
  )
}
