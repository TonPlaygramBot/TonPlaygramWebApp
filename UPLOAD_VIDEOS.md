# Uploading protest videos to Cloudflare R2

1. In the Cloudflare dashboard, open **R2 Object Storage**, select **Create bucket**, enter a bucket name, and create it.
2. Open the bucket, select **Upload**, and manually upload videos inside a `videos/` folder and WebP thumbnails inside a `thumbnails/` folder. Keep these files in R2; do not add them to GitHub.
3. In the bucket **Settings**, enable a public development URL or connect a custom public domain. Open an uploaded object and copy its public URL. Put the shared base portion of that URL (without `/videos/file.mp4`) in `R2_PUBLIC_URL` in the repository's `.env` file.
4. Add an entry to `webapp/public/videos.json` for every video:

```json
{
  "id": "video-2",
  "title": "Protest Video 2",
  "thumbnail": "thumbnails/video-2.webp",
  "video": "videos/video-2.mp4"
}
```

The `thumbnail` and `video` values are paths inside the bucket. Use a unique `id` for each entry, keep the JSON array valid, and redeploy the website after editing it.
