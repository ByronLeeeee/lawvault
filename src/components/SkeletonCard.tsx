// frontend/src/components/SkeletonCard.tsx

export const SkeletonCard = () => (
  <div className="card card-bordered bg-base-100 shadow-sm">
    <div className="card-body p-6">
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="skeleton h-6 w-3/4 rounded"></div>
        <div className="skeleton h-4 w-20 rounded"></div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="skeleton h-4 w-full rounded"></div>
        <div className="skeleton h-4 w-5/6 rounded"></div>
        <div className="skeleton h-4 w-4/6 rounded"></div>
      </div>

      <div className="flex gap-3 pt-2">
        <div className="skeleton h-5 w-16 rounded-full"></div>
        <div className="skeleton h-5 w-24 rounded-full"></div>
        <div className="skeleton h-5 w-20 rounded-full"></div>
      </div>
    </div>
  </div>
);
