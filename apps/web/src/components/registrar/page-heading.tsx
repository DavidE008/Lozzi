export function RegistrarPageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <section className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="text-lozzi-teal text-xs font-semibold tracking-[0.17em] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-[2.15rem]">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6 sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </section>
  );
}
