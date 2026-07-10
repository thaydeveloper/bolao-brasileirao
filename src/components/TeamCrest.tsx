export default function TeamCrest({
  url,
  name,
  size = 22,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
}) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className="crest"
      loading="lazy"
    />
  );
}
