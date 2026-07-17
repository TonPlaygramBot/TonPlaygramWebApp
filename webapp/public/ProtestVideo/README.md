# ProtestVideo library

Upload high-quality protest videos into this folder and publish them on the home-page gallery by editing `library.json`.

Each video entry must include:

- `id`: unique slug for the video.
- `title`: public title shown in the gallery.
- `date`: protest/video date in `YYYY-MM-DD` format.
- `time`: protest/video time in `HH:mm` 24-hour format.
- `timezone`: time zone label, for example `UTC`, `Europe/Tirane`, or `America/New_York`.
- `file`: exact filename in this `ProtestVideo` folder.
- `quality`: optional quality note, for example `1080p MP4` or `4K MP4`.
- `description`: optional short context for users.

Example:

```json
{
  "id": "tirana-protest-2026-07-17-1800",
  "title": "Tirana protest evening march",
  "date": "2026-07-17",
  "time": "18:00",
  "timezone": "Europe/Tirane",
  "file": "tirana-protest-2026-07-17-1800.mp4",
  "quality": "4K MP4",
  "description": "High-quality downloadable footage from the evening march."
}
```
