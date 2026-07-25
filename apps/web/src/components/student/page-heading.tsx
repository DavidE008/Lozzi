export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-lozzi-teal text-xs font-semibold tracking-[0.18em] uppercase">
        {eyebrow}
      </p>
      <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl leading-6">
        {description}
      </p>
    </header>
  );
}
