export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-7 border-b border-white/[0.055] pb-6">
      <span className="mb-3 block h-0.5 w-9 rounded-full bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200" />
      <h1 className="text-2xl font-semibold tracking-[-0.025em] text-white sm:text-[30px]">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400/90">{description}</p>}
    </div>
  );
}
