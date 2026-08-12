import { useEffect } from "react";

function drawCircle(context: CanvasRenderingContext2D, x: number, y: number) {
  context.beginPath();
  context.arc(x, y, 19, 0, Math.PI * 2);
  context.stroke();
}

function drawCross(context: CanvasRenderingContext2D, x: number, y: number) {
  context.beginPath();
  context.moveTo(x - 15, y - 15);
  context.lineTo(x + 15, y + 15);
  context.moveTo(x + 15, y - 15);
  context.lineTo(x - 15, y + 15);
  context.stroke();
}

function createPattern() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.strokeStyle = "#fff";
  context.lineWidth = 7;
  context.lineCap = "round";
  context.lineJoin = "round";
  drawCircle(context, 32, 32);
  drawCross(context, 96, 32);
  drawCross(context, 32, 96);
  drawCircle(context, 96, 96);
  return canvas.toDataURL("image/png");
}

export function useScenePattern() {
  useEffect(() => {
    const pattern = createPattern();
    if (!pattern) return;
    document.documentElement.style.setProperty("--scene-pattern", `url(${pattern})`);
    return () => document.documentElement.style.removeProperty("--scene-pattern");
  }, []);
}
