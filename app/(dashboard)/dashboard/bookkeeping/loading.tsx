function SkeletonLine({ className = '' }: { readonly className?: string }) {
  return <div className={`h-3 rounded-full bg-muted ${className}`} />
}

export default function BookkeepingReviewLoading() {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="sticky top-0 z-10 border-b border-company-border bg-company-surface px-7 py-3.5">
        <SkeletonLine className="w-24" />
        <SkeletonLine className="mt-2 h-5 w-32" />
      </div>
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <div className="grid gap-5 rounded-xl border border-company-border bg-company-surface p-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3">
            <SkeletonLine className="w-36" />
            <SkeletonLine className="h-7 w-64" />
            <SkeletonLine className="h-2 w-full max-w-xl" />
            <SkeletonLine className="w-80" />
          </div>
          <SkeletonLine className="h-10 w-20" />
        </div>

        <div className="flex gap-2">
          <SkeletonLine className="h-9 w-72" />
          <div className="flex-1" />
          <SkeletonLine className="h-9 w-40" />
          <SkeletonLine className="h-9 w-28" />
        </div>

        <div className="rounded-xl border border-company-border bg-company-surface p-4">
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="mt-5 h-4 w-[92%]" />
          <SkeletonLine className="mt-5 h-4 w-[85%]" />
          <SkeletonLine className="mt-5 h-4 w-[78%]" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-company-border bg-company-surface p-[18px]">
            <SkeletonLine className="w-24" />
            <SkeletonLine className="mt-4 h-4 w-full" />
            <SkeletonLine className="mt-3 h-4 w-[82%]" />
          </div>
          <div className="rounded-xl border border-company-border bg-company-surface p-[18px]">
            <SkeletonLine className="w-28" />
            <SkeletonLine className="mt-4 h-4 w-full" />
            <SkeletonLine className="mt-3 h-4 w-[70%]" />
          </div>
        </div>
      </div>
    </div>
  )
}
