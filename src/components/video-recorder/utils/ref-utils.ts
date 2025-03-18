import { RefObject } from 'react';

/**
 * Type assertion utility to safely adapt ref objects between components
 * with different type expectations
 */
export function assertRefType<T>(ref: RefObject<T | null>): RefObject<T> {
  return ref as unknown as RefObject<T>;
} 