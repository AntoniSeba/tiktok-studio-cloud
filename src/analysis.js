// analysis.js: turn raw stats into "what is winning" for one workspace.
// Same scoring idea as the local studio: absolute watch time first, retention
// weighted by length second, then engagement and a small reach bonus.
import { listVideos } from './db.js';

export const FACTORS = { hook: 'Hook', topic: 'Temat', visual: 'Styl wizualny', voice: 'Głos', pace: 'Tempo', cta: 'CTA', category: 'Kategoria' };

function estimatedDuration(v) {
  if (v.duration_sec > 0) return v.duration_sec;
  const w = Number(v.avg_watch) || 0, c = Number(v.completion) || 0;
  if (w > 0 && c > 0) return Math.max(w, w / (c / 100));
  return w > 0 ? w * 3 : 0;
}

export function score(v) {
  const views = Number(v.views) || 0;
  const w = Number(v.avg_watch) || 0;
  const c = Number(v.completion) || 0;
  const d = estimatedDuration(v);
  const watch = Math.min(40, Math.log1p(Math.max(0, w)) * 14);
  const durWeight = Math.min(1, Math.max(0.35, d / 18));
  const retention = Math.min(35, c * 1.8 * durWeight * (d > 0 && d < 7 ? 0.65 : 1) * (w > 0 && w < 5 ? 0.75 : 1));
  const engage = (Number(v.likes) + Number(v.saves) * 2 + Number(v.shares) * 3 + Number(v.comments) * 2);
  const reach = Math.min(12, Math.log10(views + 1) * 4);
  // no likes/comments/shares/saves entered means "unknown", not "zero": rescale the rest to 100
  // instead of punishing a video whose owner only copied views and watch time
  if (!engage) return (watch + retention + reach) * (100 / 87);
  const engagement = Math.min(20, (views > 0 ? (engage / views) * 100 : 0) * 5);
  return watch + retention + engagement + reach;
}

export function analyze(wsId, channelId) {
  const all = listVideos(wsId, channelId);
  const measured = all.filter(v => v.views > 0 || v.completion > 0 || v.avg_watch > 0);
  const perFactor = {};
  for (const f of Object.keys(FACTORS)) {
    const buckets = {};
    for (const v of measured) {
      const key = String(v[f] || '').trim();
      if (!key) continue;
      (buckets[key] ||= []).push(v);
    }
    perFactor[f] = Object.entries(buckets).map(([value, vids]) => {
      const n = vids.length;
      const avg = (k) => vids.reduce((a, b) => a + (Number(b[k]) || 0), 0) / n;
      return { value, n, avgViews: Math.round(avg('views')), avgWatch: +avg('avg_watch').toFixed(1),
        avgCompletion: +avg('completion').toFixed(1), score: +(vids.reduce((a, b) => a + score(b), 0) / n).toFixed(1) };
    }).sort((a, b) => b.score - a.score);
  }
  const ranked = measured.map(v => ({ id: v.id, title: v.title, views: v.views, avg_watch: v.avg_watch,
    completion: v.completion, score: +score(v).toFixed(1) })).sort((a, b) => b.score - a.score);
  const recommendations = [];
  for (const [f, label] of Object.entries(FACTORS)) {
    const rows = perFactor[f].filter(b => b.n >= 2);
    if (rows.length >= 2) {
      const win = rows[0], lose = rows[rows.length - 1];
      recommendations.push({ factor: f, label, winner: win.value, n: win.n, score: win.score,
        text: `${label}: "${win.value}" (śr. ${win.avgViews} wyśw., ${win.avgCompletion}% do końca) bije "${lose.value}" (${lose.avgViews} wyśw.).` });
    }
  }
  return { totalVideos: all.length, sampleSize: measured.length, perFactor, factors: FACTORS,
    top: ranked.slice(0, 5), bottom: ranked.length > 5 ? ranked.slice(-3).reverse() : [], recommendations };
}
