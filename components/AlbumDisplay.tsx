import type { ActivityAlbum, AlbumPhoto } from "@/types";
export function AlbumDisplay({
  album,
  photo,
  position,
  total,
  schoolName,
  fading,
}: {
  album: ActivityAlbum;
  photo: AlbumPhoto;
  position: number;
  total: number;
  schoolName: string;
  fading: boolean;
}) {
  return (
    <section
      className={`activity-display ${fading ? "activity-display-exit" : ""}`}
      aria-label="活動相簿"
    >
      <div className="activity-image-frame">
        <img
          key={photo.id}
          src={photo.image}
          alt={photo.caption || album.title}
          style={{ objectFit: album.fit }}
        />
        <div className="activity-gradient" />
        <div className="activity-brand">♪ {schoolName}</div>
        <div className="activity-caption">
          <div>
            <small>OUR MUSIC MOMENTS · 活動相簿</small>
            <h1>{album.title}</h1>
            <p>
              {album.date}
              {photo.caption ? ` · ${photo.caption}` : ""}
            </p>
          </div>
          <span>
            {position + 1} / {total}
          </span>
        </div>
      </div>
    </section>
  );
}
