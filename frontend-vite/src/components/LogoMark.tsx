type LogoMarkProps = {
  src: string | null;
  label: string;
};

export default function LogoMark({ src, label }: LogoMarkProps) {
  if (src) {
    return <img src={src} alt="" aria-hidden="true" />;
  }

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "R";

  return <span aria-hidden="true">{initials}</span>;
}
