export default function RegistrarLoading() {
  return (
    <div className="animate-pulse" aria-label="Loading registrar workspace">
      <div className="bg-muted h-10 w-72 rounded-sm" />
      <div className="bg-muted mt-3 h-4 w-full max-w-xl rounded-sm" />
      <div className="bg-border mt-8 grid gap-px overflow-hidden rounded-sm border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-card h-32 p-5">
            <div className="bg-muted h-3 w-28 rounded-sm" />
            <div className="bg-muted mt-6 h-8 w-16 rounded-sm" />
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-7 xl:grid-cols-[1.65fr_0.75fr]">
        <div className="bg-card h-80 rounded-sm border" />
        <div className="bg-card h-80 rounded-sm border" />
      </div>
    </div>
  );
}
