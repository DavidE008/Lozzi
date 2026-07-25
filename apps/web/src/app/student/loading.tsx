export default function StudentLoading() {
  return (
    <div
      aria-label="Loading student workspace"
      aria-live="polite"
      className="animate-pulse"
    >
      <div className="bg-muted h-3 w-32 rounded-sm" />
      <div className="bg-muted mt-4 h-10 w-80 max-w-full rounded-sm" />
      <div className="bg-border mt-10 grid gap-px overflow-hidden rounded-sm border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-card h-36 p-5">
            <div className="bg-muted h-3 w-24 rounded-sm" />
            <div className="bg-muted mt-7 h-8 w-28 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
