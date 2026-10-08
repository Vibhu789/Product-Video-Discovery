import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// pick(obj, 'a.b', 'c.0.d') returns the first non-empty value found
const pick = (obj, ...paths) => {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => o?.[k], obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};

const toMs = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

export function mapInstagram(item) {
  const id = pick(item, 'id', 'pk', 'shortCode', 'code');
  const code = pick(item, 'shortCode', 'code');
  const url = pick(item, 'url', 'permalink') || (code ? `https://www.instagram.com/reel/${code}/` : null);
  const videoUrl = pick(item, 'videoUrl', 'video_url');
  const isVideo = item.type === 'Video' || item.productType === 'clips' || !!videoUrl;
  if (!url || !isVideo) return null; // photos and carousels are not videos

  return {
    platform: 'instagram',
    videoKey: String(id || sha(url)),
    url,
    videoUrl,
    thumbnail: pick(item, 'displayUrl', 'thumbnailUrl', 'thumbnail_url', 'imageUrl'),
    caption: pick(item, 'caption', 'text') ?? '',
    postedAt: toMs(pick(item, 'timestamp', 'takenAt', 'taken_at')),
    groupKey: item.collationId ? String(item.collationId) : null,
  };
}

export function mapMeta(item) {
  const id = pick(item, 'ad_archive_id', 'adArchiveID', 'adArchiveId', 'id');
  const video = pick(item, 'snapshot.videos.0', 'videos.0');
  if (!id || !video) return null; // image-only ads are skipped

  return {
    platform: 'meta',
    videoKey: String(id),
    url: `https://www.facebook.com/ads/library/?id=${id}`,
    videoUrl: video.video_hd_url || video.video_sd_url || video.videoHdUrl || video.videoSdUrl || null,
    thumbnail: video.video_preview_image_url || video.videoPreviewImageUrl || null,
    caption: pick(item, 'snapshot.body.text', 'snapshot.title', 'adCreativeBody', 'body') ?? '',
    postedAt: toMs(pick(item, 'start_date', 'startDate', 'startDateFormatted')),
  };
}