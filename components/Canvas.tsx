import { useRef, useEffect, forwardRef, useState, useCallback } from "react"
import type { DrawingState } from "../types"

interface CanvasProps {
  drawingState: DrawingState
  setDrawingState: (newState: DrawingState) => void
}

const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(({ drawingState, setDrawingState }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentShape, setCurrentShape] = useState<ImageData | null>(null)

  const [canvasSize, setCanvasSize] = useState({ width: 1920, height: 1080 })

  useEffect(() => {
    const updateCanvasSize = () => {
      const container = canvasRef.current?.parentElement
      if (container) {
        const { width, height } = container.getBoundingClientRect()
        setCanvasSize({ width, height })
      }
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)
    return () => window.removeEventListener("resize", updateCanvasSize)
  }, [])

  useEffect(() => {
    if (ref) {
      if (typeof ref === "function") {
        ref(canvasRef.current)
      } else {
        ref.current = canvasRef.current
      }
    }
  }, [ref])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasSize.width * 2 // Increase resolution
    canvas.height = canvasSize.height * 2 // Increase resolution

    const context = canvas.getContext("2d", { alpha: false })
    if (context) {
      context.scale(2, 2) // Scale up for higher resolution
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.fillStyle = "hsl(var(--background))"
      context.fillRect(0, 0, canvas.width, canvas.height)
      setCtx(context)
    }
  }, [canvasSize])

  const getMousePos = useCallback((canvas: HTMLCanvasElement, evt: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width / 2 // Adjust for increased resolution
    const scaleY = canvas.height / rect.height / 2 // Adjust for increased resolution
    const clientX = "touches" in evt ? evt.touches[0].clientX : evt.clientX
    const clientY = "touches" in evt ? evt.touches[0].clientY : evt.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }, [])

  const startDrawing = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!canvasRef.current || !ctx) return
      const { x, y } = getMousePos(canvasRef.current, e)

      setIsDrawing(true)
      setLastPoint({ x, y })
      if (drawingState.tool === "brush" || drawingState.tool === "eraser") {
        ctx.beginPath()
        ctx.moveTo(x, y)
      } else {
        setCurrentShape(ctx.getImageData(0, 0, canvasSize.width * 2, canvasSize.height * 2))
      }
    },
    [ctx, drawingState.tool, getMousePos, canvasSize],
  )

  const draw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!canvasRef.current || !ctx || !isDrawing || !lastPoint) return;
      const { x, y } = getMousePos(canvasRef.current, e);

      ctx.strokeStyle = drawingState.tool === "eraser" ? "hsl(var(--background))" : drawingState.color;
      ctx.lineWidth = drawingState.brushWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (drawingState.tool === "brush" || drawingState.tool === "eraser") {
        ctx.lineTo(x, y);
        ctx.stroke();
        setLastPoint({ x, y });
      } else if (currentShape) {
        ctx.putImageData(currentShape, 0, 0);
        ctx.beginPath();

        switch (drawingState.tool) {
          case "rectangle":
            ctx.rect(lastPoint.x, lastPoint.y, x - lastPoint.x, y - lastPoint.y);
            break;
          case "circle":
            const radius = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
            ctx.arc(lastPoint.x, lastPoint.y, radius, 0, 2 * Math.PI);
            break;
          case "triangle":
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(x, y);
            ctx.lineTo(lastPoint.x - (x - lastPoint.x), y);
            ctx.closePath();
            break;
          case "line":
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(x, y);
            break;
        }

        if (drawingState.fillColor) {
          ctx.fillStyle = drawingState.color;
          ctx.fill();
        }
        ctx.stroke();
      }
    },
    [isDrawing, lastPoint, ctx, drawingState, currentShape, getMousePos],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    setCurrentShape(null)
    if (ctx) ctx.closePath()
  }, [ctx])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      startDrawing(e)
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      if (isDrawing) {
        draw(e)
      }
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault()
      stopDrawing()
      setIsDrawing(false)
      setLastPoint(null)
    }
    
    const handleMouseOut = (e: MouseEvent) => {
      e.preventDefault()
      stopDrawing()
      setIsDrawing(false)
      setLastPoint(null)
    }

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      startDrawing(e)
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (isDrawing) {
        draw(e)
      }
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      stopDrawing()
      setIsDrawing(false)
      setLastPoint(null)
    }

    // Add window-level event listeners for mouse up
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("mouseleave", handleMouseOut)

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseout", handleMouseOut)

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false })
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("touchend", handleTouchEnd)

    return () => {
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("mouseleave", handleMouseOut)
      
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseout", handleMouseOut)

      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("touchend", handleTouchEnd)
    }
  }, [startDrawing, draw, stopDrawing, isDrawing])

  useEffect(() => {
    if (ctx && canvasRef.current) {
      if (drawingState.canvasData) {
        const img = new Image()
        img.onload = () => {
          if (!ctx || !canvasRef.current) return
          ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height)
        }
        img.src = drawingState.canvasData
      } else {
        ctx.fillStyle = "hsl(var(--background))"
        ctx.fillRect(0, 0, canvasSize.width * 2, canvasSize.height * 2)
      }
    }
  }, [ctx, drawingState.canvasData, canvasSize])

  useEffect(() => {
    if (ctx && canvasRef.current) {
      if (drawingState.canvasData) {
        const img = new Image()
        img.onload = () => {
          if (!ctx || !canvasRef.current) return
          ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height)
        }
        img.src = drawingState.canvasData
      } else {
        ctx.fillStyle = "hsl(var(--background))"
        ctx.fillRect(0, 0, canvasSize.width * 2, canvasSize.height * 2)
      }
    }
  }, [drawingState, ctx, canvasSize])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        touchAction: "none",
      }}
    />
  )
})

Canvas.displayName = "Canvas"

export default Canvas

