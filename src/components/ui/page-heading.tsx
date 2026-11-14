export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
    </div>
  );
}
