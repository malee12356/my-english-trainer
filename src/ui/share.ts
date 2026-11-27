/**
 * Sharing a challenge result (e.g. to a parent via WhatsApp).
 * - iPhone: native share sheet (WhatsApp, Messages …) with an image card + text.
 * - Fallback: WhatsApp link with the text.
 */
import type { ChallengeResult } from '../domain/challenge';
import { challengeShareText } from '../domain/challenge';

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Render a small result card as PNG (no external assets, canvas only). */
export async function resultImage(r: ChallengeResult): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1080;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#7c3aed');
  grad.addColorStop(0.55, '#db2777');
  grad.addColorStop(1, '#f97316');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  const font = (size: number, weight = 800) => `${weight} ${size}px ui-rounded, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.font = font(200, 400);
  g.fillText('🤖', 540, 300);
  g.font = font(72);
  g.fillText('English-Challenge', 540, 420);
  g.font = font(150);
  g.fillText(`🎮 ${r.minutes} min`, 540, 610);
  g.font = font(60, 700);
  g.fillText(`${r.correct} von ${r.total} Wörtern richtig`, 540, 730);
  g.font = font(44, 500);
  g.fillText(r.answer === 'writing' ? 'geschrieben' : 'gesprochen', 540, 800);
  g.fillText(r.finishedAt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }), 540, 900);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

export async function shareResult(r: ChallengeResult): Promise<ShareOutcome> {
  const text = challengeShareText(r);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!navigator.share) return 'unsupported';
  try {
    const blob = await resultImage(r);
    const file = blob && typeof File !== 'undefined' ? new File([blob], 'english-challenge.png', { type: 'image/png' }) : null;
    if (file && nav.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: 'English-Challenge' });
    else await navigator.share({ text, title: 'English-Challenge' });
    return 'shared';
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}
