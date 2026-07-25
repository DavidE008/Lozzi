export default function StudentLoading() {
  return (
    <div aria-label="Loading student workspace" aria-live="polite" className="animate-pulse">
      <div className="h-3 w-32 rounded-sm bg-muted" />
      <div className="mt-4 h-10 w-80 max-w-full rounded-sm bg-muted" />
      <div className="mt-10 grid gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 bg-card p-5">
            <div className="h-3 w-24 rounded-sm bg-muted" />
            <div className="mt-7 h-8 w-28 rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
