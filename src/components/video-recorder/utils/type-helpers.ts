import { CanvasRenderingContext2DExtended } from '../types';

/**
 * Helper function to safely cast ref types when TypeScript
 * doesn't recognize them as compatible
 */
export function castRef<T>(ref: React.RefObject<T | null>): React.RefObject<T> {
  return ref as unknown as React.RefObject<T>;
}

/**
 * Helper function to safely use canvas context with extended features
 */
export function getExtendedCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2DExtended {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }
  return ctx as CanvasRenderingContext2DExtended;
} 