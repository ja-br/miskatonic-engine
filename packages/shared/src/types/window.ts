/**
 * Window configuration types
 */
export interface WindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  frame: boolean;
  title: string;
  backgroundColor: string;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
