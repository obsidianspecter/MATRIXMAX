export type Tool = "brush" | "eraser" | "rectangle" | "circle" | "triangle" | "line" | "text-recognition";

export interface DrawingState {
  isDrawing: boolean;
  tool: Tool;
  color: string;
  brushWidth: number;
  fillColor: boolean;
  canvasData: string | null;
  recognizedText?: string;
}