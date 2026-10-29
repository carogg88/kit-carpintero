/** Grabar videos de un canvas en el navegador: el armado animado y el mueble girando en la foto. */

/** Formatos en orden de preferencia: mp4 se abre en todos lados, webm si el navegador no graba mp4. */
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

/** El formato en que graba este navegador, o null si no puede grabar video. */
export function videoType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  return VIDEO_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** Los codificadores de video piden medidas pares. */
export const even = (x: number) => Math.max(2, Math.round(x / 2) * 2);
export const videoMime = (type: string) => type.split(';')[0]!;
export const videoExt = (type: string) => (type.startsWith('video/mp4') ? 'mp4' : 'webm');

/**
 * Graba lo que se dibuja en `out`: llama a `frame` con los segundos que pasaron en cada cuadro de pantalla, hasta que
 * devuelve false, y entrega el video.
 */
export function recordCanvas(out: HTMLCanvasElement, type: string, frame: (seconds: number) => boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(out.captureStream(30), { mimeType: type, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => resolve(new Blob(chunks, { type: videoMime(type) }));
    recorder.onerror = () => reject(new Error('video'));
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      if (frame((now - start) / 1000)) requestAnimationFrame(tick);
      else recorder.stop();
    };
    recorder.start(250);
    requestAnimationFrame(tick);
  });
}
