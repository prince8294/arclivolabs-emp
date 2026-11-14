export function UserAvatar({
  name,
  src,
  className = "",
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-label={name}
      role="img"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-linear-to-br from-violet-500/30 to-indigo-500/20 font-semibold text-violet-100 ${className}`}
      style={src ? { backgroundImage: `url("${src.replaceAll('"', "%22")}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
    >
      {!src && initials}
    </span>
  );
}
