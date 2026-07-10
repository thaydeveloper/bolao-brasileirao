import Link from "next/link";
import Avatar from "./Avatar";

/** Célula de jogador clicável que leva ao perfil do participante. */
export default function PlayerLink({
  id,
  name,
  photoUrl,
}: {
  id: number;
  name: string;
  photoUrl: string | null;
}) {
  return (
    <Link href={`/jogador/${id}`} className="player-cell player-link">
      <Avatar name={name} photoUrl={photoUrl} />
      <span className="player-link-name">{name}</span>
    </Link>
  );
}
