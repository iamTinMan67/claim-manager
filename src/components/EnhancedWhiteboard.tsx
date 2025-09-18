import React, { useRef, useState, useEffect, useCallback } from 'react'
import { 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Undo, 
  Redo, 
  Palette, 
  Type, 
  Square, 
  Circle, 
  Minus, 
  Eraser,
  Image as ImageIcon,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'

interface WhiteboardProps {
  selectedClaim: string | null
  claimColor?: string
  isGuest?: boolean
  onShare?: (imageData: string) => void
  onSave?: (imageData: string) => void
}

interface DrawingState {
  isDrawing: boolean
  startX: number
  startY: number
  lastX: number
  lastY: number
}

interface ImageElement {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const EnhancedWhiteboard: React.FC<WhiteboardProps> = ({
  selectedClaim,
  claimColor = '#3B82F6',
  isGuest = false,
  onShare,
  onSave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text' | 'rectangle' | 'circle' | 'line' | 'image'>('pen')
  const [color, setColor] = useState(claimColor)
  const [brushSize, setBrushSize] = useState(2)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0
  })
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [images, setImages] = useState<ImageElement[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 })

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A',
    '#808080', '#000080', '#008000', '#800000', '#FFD700', '#C0C0C0'
  ]

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 1000
    canvas.height = 600

    // Set default styles
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Save initial state
    saveToHistory()
  }, [])

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const imageData = canvas.toDataURL()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(imageData)
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(historyIndex + 1)
    }
    
    setHistory(newHistory)
  }, [history, historyIndex])

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const image = new Image()
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)
      }
      image.src = history[historyIndex - 1]
      setHistoryIndex(historyIndex - 1)
    }
  }, [history, historyIndex])

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const image = new Image()
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)
      }
      image.src = history[historyIndex + 1]
      setHistoryIndex(historyIndex + 1)
    }
  }, [history, historyIndex])

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    setIsDrawing(true)
    setDrawingState({
      isDrawing: true,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y
    })

    if (tool === 'text') {
      setTextPosition({ x, y })
      setShowTextInput(true)
    }
  }

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = tool === 'eraser' ? 'white' : color
    ctx.lineWidth = tool === 'eraser' ? brushSize * 2 : brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath()
      ctx.moveTo(drawingState.lastX, drawingState.lastY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    setDrawingState(prev => ({
      ...prev,
      lastX: x,
      lastY: y
    }))
  }

  // Mouse up handler
  const handleMouseUp = () => {
    if (!isDrawing) return

    setIsDrawing(false)
    setDrawingState(prev => ({ ...prev, isDrawing: false }))
    saveToHistory()
  }

  // Draw shapes
  const drawShape = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.beginPath()

    switch (tool) {
      case 'rectangle':
        ctx.rect(startX, startY, endX - startX, endY - startY)
        break
      case 'circle':
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI)
        break
      case 'line':
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        break
    }
    ctx.stroke()
  }

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !canvasRef.current) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Add to images array for manipulation
        const newImage: ImageElement = {
          id: Date.now().toString(),
          src: event.target?.result as string,
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
          rotation: 0
        }
        setImages(prev => [...prev, newImage])
        saveToHistory()
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Add text to canvas
  const addText = () => {
    if (!textInput.trim() || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = color
    ctx.font = `${brushSize * 5}px Arial`
    ctx.fillText(textInput, textPosition.x, textPosition.y)
    
    setTextInput('')
    setShowTextInput(false)
    saveToHistory()
  }

  // Clear canvas
  const clearCanvas = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    setImages([])
    saveToHistory()
  }

  // Save canvas as image
  const saveCanvas = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const imageData = canvas.toDataURL('image/png')
    
    if (onSave) {
      onSave(imageData)
    } else {
      // Download as file
      const link = document.createElement('a')
      link.download = `whiteboard-${Date.now()}.png`
      link.href = imageData
      link.click()
    }
  }

  // Share canvas
  const shareCanvas = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const imageData = canvas.toDataURL('image/png')
    
    if (onShare) {
      onShare(imageData)
    }
  }

  // Download canvas
  const downloadCanvas = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const imageData = canvas.toDataURL('image/png')
    
    const link = document.createElement('a')
    link.download = `whiteboard-${Date.now()}.png`
    link.href = imageData
    link.click()
  }

  return (
    <div className="card-enhanced rounded-lg shadow">
      <div className="card-smudge p-4">
        <h3 className="text-lg font-bold text-white mb-4">Enhanced Whiteboard</h3>
        
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Drawing Tools */}
          <div className="flex gap-1">
            <button
              onClick={() => setTool('pen')}
              className={`px-3 py-2 rounded ${tool === 'pen' ? 'bg-yellow-400/30 text-gold' : 'bg-yellow-400/20 text-gold'}`}
              title="Pen"
            >
              <Type className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`px-3 py-2 rounded ${tool === 'eraser' ? 'bg-yellow-400/30 text-gold' : 'bg-yellow-400/20 text-gold'}`}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('text')}
              className={`px-3 py-2 rounded ${tool === 'text' ? 'bg-yellow-400/30 text-gold' : 'bg-yellow-400/20 text-gold'}`}
              title="Text"
            >
              <Type className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('rectangle')}
              className={`px-3 py-2 rounded ${tool === 'rectangle' ? 'bg-yellow-400/30 text-gold' : 'bg-yellow-400/20 text-gold'}`}
              title="Rectangle"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`px-3 py-2 rounded ${tool === 'circle' ? 'bg-yellow-400/30 text-gold' : 'bg-yellow-400/20 text-gold'}`}
              title="Circle"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('line')}
              className={`px-3 py-2 rounded ${tool === 'line' ? 'bg-yellow-400/30 text-gold' : 'bg-yellow-400/20 text-gold'}`}
              title="Line"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Color Palette */}
          <div className="flex gap-1 ml-4">
            {colors.map((colorOption) => (
              <button
                key={colorOption}
                onClick={() => setColor(colorOption)}
                className={`w-8 h-8 rounded border-2 ${
                  color === colorOption ? 'border-white' : 'border-gray-300'
                }`}
                style={{ backgroundColor: colorOption }}
                title={colorOption}
              />
            ))}
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2 ml-4">
            <label className="text-white text-sm">Size:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-white text-sm">{brushSize}px</span>
          </div>

          {/* Actions */}
          <div className="flex gap-1 ml-4">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="px-3 py-2 bg-yellow-400/20 text-gold rounded disabled:opacity-50"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="px-3 py-2 bg-yellow-400/20 text-gold rounded disabled:opacity-50"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-yellow-400/20 text-gold rounded"
              title="Upload Image"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={saveCanvas}
              className="px-3 py-2 bg-yellow-400/20 text-gold rounded"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={shareCanvas}
              className="px-3 py-2 bg-yellow-400/20 text-gold rounded"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={downloadCanvas}
              className="px-3 py-2 bg-yellow-400/20 text-gold rounded"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={clearCanvas}
              className="px-3 py-2 bg-red-500/20 text-red-300 rounded"
              title="Clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="border-2 border-yellow-400/30 rounded-lg overflow-hidden card-enhanced">
          <div 
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="inline-block"
          >
            <canvas
              ref={canvasRef}
              width={1000}
              height={600}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="px-2 py-1 bg-yellow-400/20 text-gold rounded"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white text-sm">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="px-2 py-1 bg-yellow-400/20 text-gold rounded"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Text Input Modal */}
        {showTextInput && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card-enhanced p-6 rounded-lg">
              <h3 className="text-lg font-bold text-white mb-4">Add Text</h3>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter text..."
                className="w-full p-2 border rounded mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={addText}
                  className="px-4 py-2 bg-yellow-400/20 text-gold rounded"
                >
                  Add Text
                </button>
                <button
                  onClick={() => setShowTextInput(false)}
                  className="px-4 py-2 bg-gray-500/20 text-gray-300 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  )
}

export default EnhancedWhiteboard
