// Define custom event types
import { ViewMode } from '../types';

declare global {
  interface WindowEventMap {
    // Add our custom event to the WindowEventMap
    'recorder:viewModeChanged': CustomEvent<{ viewMode: ViewMode }>;
  }
} 