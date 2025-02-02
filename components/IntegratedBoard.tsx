"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Canvas from "./Canvas"
import ToolBar from "./ToolBar"
import { VideoCall } from "./VideoCall"
import PageNavigation from "./PageNavigation"
import type { DrawingState, Tool } from "../types"
import io from "socket.io-client"
import { Peer } from "peerjs"
import { useTheme } from "next-themes"
import { Sun, Moon, Download } from "lucide-react"
import jsPDF from "jspdf"
import TextRecognition from "./TextRecognition"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const SOCKET_SERVER = "http://localhost:3030"
const PEER_SERVER = "http://localhost:3030/peerjs"

export default function IntegratedBoard() {
  const [pages, setPages] = useState<DrawingState[]>([
    {
      isDrawing: false,
      tool: "brush",
      color: "#FFFFFF",
      brushWidth: 5,
      fillColor: false,
      canvasData: null,
    },
  ])
  const [currentPage, setCurrentPage] = useState(0)
  const drawingState = pages[currentPage]

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [roomId, setRoomId] = useState("")
  const [peerId, setPeerId] = useState("")
  const [socket, setSocket] = useState<any>(null)
  const [peer, setPeer] = useState<Peer | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({})
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const previousStream = useRef<MediaStream | null>(null)

  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)

  const { theme, setTheme } = useTheme()

  const [recognizedText, setRecognizedText] = useState<string>("");
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);

  const handleToolChange = (tool: Tool) => {
    setPages((prevPages) => {
      const newPages = [...prevPages]
      newPages[currentPage] = { ...newPages[currentPage], tool }
      return newPages
    })
  }

  const handleColorChange = (color: string) => {
    setPages((prevPages) => {
      const newPages = [...prevPages]
      newPages[currentPage] = { ...newPages[currentPage], color }
      return newPages
    })
  }

  const handleBrushWidthChange = (width: number) => {
    setPages((prevPages) => {
      const newPages = [...prevPages]
      newPages[currentPage] = { ...newPages[currentPage], brushWidth: width }
      return newPages
    })
  }

  const handleClearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (ctx && canvas) {
      ctx.fillStyle = theme === "dark" ? "#000000" : "#FFFFFF"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      setPages((prevPages) => {
        const newPages = [...prevPages]
        newPages[currentPage] = {
          ...newPages[currentPage],
          canvasData: null,
        }
        return newPages
      })
    }
  }

  const createRoom = () => {
    if (socket && peerId) {
      const newRoomId = Math.random().toString(36).substring(7)
      socket.emit("create-room", newRoomId, peerId)
      setRoomId(newRoomId)
      setIsCreatingRoom(true)
    }
  }

  const joinRoom = (roomToJoin: string = roomId) => {
    if (socket && peerId && roomToJoin) {
      socket.emit("join-room", roomToJoin, peerId)
      setIsJoiningRoom(true)
    }
  }

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER)
    setSocket(newSocket)

    const newPeer = new Peer({
      host: new URL(PEER_SERVER).hostname,
      port: Number.parseInt(new URL(PEER_SERVER).port),
      path: "/peerjs",
    })

    setPeer(newPeer)

    newPeer.on("open", (id) => {
      setPeerId(id)
    })

    return () => {
      newSocket.disconnect()
      newPeer.destroy()
    }
  }, [])

  useEffect(() => {
    if (peer && socket) {
      peer.on("call", (call) => {
        if (stream) {
          call.answer(stream)
          call.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => ({ ...prev, [call.peer]: remoteStream }))
          })
        }
      })

      socket.on("user-connected", (userId: string) => {
        console.log("User connected:", userId)
        if (stream) {
          const call = peer.call(userId, stream)
          call.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => ({ ...prev, [userId]: remoteStream }))
          })
        }
      })

      socket.on("user-disconnected", (userId: string) => {
        console.log("User disconnected:", userId)
        setRemoteStreams((prev) => {
          const newStreams = { ...prev }
          delete newStreams[userId]
          return newStreams
        })
      })

      socket.on("user-audio-change", (userId: string, enabled: boolean) => {
        console.log(`User ${userId} ${enabled ? "unmuted" : "muted"} their audio`)
      })

      socket.on("user-video-change", (userId: string, enabled: boolean) => {
        console.log(`User ${userId} ${enabled ? "enabled" : "disabled"} their video`)
      })

      socket.on("room-created", (createdRoomId: string) => {
        console.log("Room created:", createdRoomId)
        setRoomId(createdRoomId)
        setIsCreatingRoom(false)
      })

      socket.on("error", (message: string) => {
        console.error("Socket error:", message)
        setIsJoiningRoom(false)
      })
    }
  }, [peer, socket, stream])

  const startVideo = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      setStream(mediaStream)
      setIsVideoEnabled(true)
      setIsAudioEnabled(true)
      previousStream.current = mediaStream
    } catch (error) {
      console.error("Error accessing media devices:", error)
    }
  }

  const toggleVideo = async () => {
    if (!stream) {
      await startVideo()
      return
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoEnabled(!isVideoEnabled)
      socket.emit("toggle-video", roomId, peerId, videoTrack.enabled)
    }
  }

  const toggleAudio = () => {
    if (!stream) return

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsAudioEnabled(!isAudioEnabled)
      socket.emit("toggle-audio", roomId, peerId, audioTrack.enabled)
    }
  }

  const shareScreen = async () => {
    try {
      if (isScreenSharing) {
        if (stream) {
          const tracks = stream.getTracks()
          tracks.forEach((track) => track.stop())
        }
        if (previousStream.current) {
          setStream(previousStream.current)
        }
        setIsScreenSharing(false)
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        })

        if (stream && !previousStream.current) {
          previousStream.current = stream
        }

        screenStream.getVideoTracks()[0].onended = () => {
          if (previousStream.current) {
            setStream(previousStream.current)
          }
          setIsScreenSharing(false)
        }

        setStream(screenStream)
        setIsScreenSharing(true)

        // Update all peer connections with the new stream
        if (peer && Object.keys(remoteStreams).length > 0) {
          Object.keys(remoteStreams).forEach((userId) => {
            const call = peer.call(userId, screenStream)
            call.on("stream", (remoteStream) => {
              setRemoteStreams((prev) => ({ ...prev, [userId]: remoteStream }))
            })
          })
        }
      }
    } catch (error) {
      console.error("Error sharing screen:", error)
      if (previousStream.current) {
        setStream(previousStream.current)
      }
      setIsScreenSharing(false)
    }
  }

  const addPage = () => {
    // Save the current canvas state before adding a new page
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get the current canvas state
    const currentCanvasData = canvas.toDataURL();
    
    setPages(prevPages => {
      const newPages = [...prevPages];
      // Update the current page's canvas data
      newPages[currentPage] = {
        ...newPages[currentPage],
        canvasData: currentCanvasData,
      };
      // Add the new page
      return [
        ...newPages,
        {
          isDrawing: false,
          tool: "brush",
          color: "#FFFFFF",
          brushWidth: 5,
          fillColor: false,
          canvasData: null,
        },
      ];
    });
    
    // Set to the new page after updating
    setCurrentPage(prevPage => prevPage + 1);
  }

  const removePage = (index: number) => {
    if (pages.length > 1) {
      const newPages = pages.filter((_, i) => i !== index)
      setPages(newPages)
      setCurrentPage(Math.min(currentPage, newPages.length - 1))
    }
  }

  const updateCurrentPage = (newState: DrawingState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get the current canvas state
    const currentCanvasData = canvas.toDataURL();
    
    setPages((prevPages) => {
      const newPages = [...prevPages];
      newPages[currentPage] = {
        ...newPages[currentPage],
        ...newState,
        canvasData: currentCanvasData,
      };
      return newPages;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Get the container dimensions
        const container = canvas.parentElement;
        if (!container) return;

        const { width, height } = container.getBoundingClientRect();
        
        // Set canvas dimensions with higher resolution
        canvas.width = width * 2;
        canvas.height = height * 2;
        
        // Scale for high DPI
        ctx.scale(2, 2);
        
        // Clear the canvas first
        ctx.clearRect(0, 0, width, height);
        
        // Fill with background color
        ctx.fillStyle = theme === "dark" ? "#000000" : "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // If there's saved data for the current page, load it
        const pageData = pages[currentPage]?.canvasData;
        if (pageData) {
          const img = new Image();
          img.src = pageData;
          img.onload = () => {
            // Clear again before drawing the image
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = theme === "dark" ? "#000000" : "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            // Draw the image at the correct scale
            ctx.drawImage(img, 0, 0, width, height);
          };
        }

        // Set up event listener for canvas changes
        const handleCanvasChange = () => {
          if (canvas) {
            updateCurrentPage(pages[currentPage]);
          }
        };

        // Add event listeners for mouse and touch events
        canvas.addEventListener("mouseup", handleCanvasChange);
        canvas.addEventListener("touchend", handleCanvasChange);

        return () => {
          canvas.removeEventListener("mouseup", handleCanvasChange);
          canvas.removeEventListener("touchend", handleCanvasChange);
        };
      }
    }
  }, [currentPage, pages, theme]);

  const exportToPDF = async () => {
    // Initialize PDF in landscape orientation
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const canvasWidth = canvasRef.current?.width || 1920;
    const canvasHeight = canvasRef.current?.height || 1080;
    
    // Get PDF dimensions (in landscape, width is longer than height)
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate scaling ratio while maintaining aspect ratio
    const scale = Math.min(
      pdfWidth / canvasWidth,
      pdfHeight / canvasHeight
    );
    
    // Calculate centered position
    const xOffset = (pdfWidth - canvasWidth * scale) / 2;
    const yOffset = (pdfHeight - canvasHeight * scale) / 2;

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) {
        pdf.addPage([pdfWidth, pdfHeight], "landscape");
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Draw background
        ctx.fillStyle = theme === "dark" ? "#000000" : "#FFFFFF";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw the page content
        if (pages[i].canvasData && typeof pages[i].canvasData === 'string') {
          const img = new Image();
          img.src = pages[i].canvasData;
          await new Promise((resolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
              resolve(null);
            };
          });
        }

        const imgData = canvas.toDataURL("image/png");
        // Add image with calculated dimensions and position
        pdf.addImage(
          imgData,
          "PNG",
          xOffset,
          yOffset,
          canvasWidth * scale,
          canvasHeight * scale
        );
      }
    }

    pdf.save("canvas_drawing.pdf");
  };

  const handleTextRecognized = (text: string) => {
    setRecognizedText(text);
    setIsTextDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-bold text-foreground">Matrix Digital Learning Board</h1>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-32 bg-background text-foreground border-border"
            />
            <Button onClick={() => joinRoom()} disabled={isJoiningRoom} 
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isJoiningRoom ? "Joining..." : "Join"}
            </Button>
            <Button onClick={createRoom} disabled={isCreatingRoom}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isCreatingRoom ? "Creating..." : "Create Room"}
            </Button>
            <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="space-y-4">
            <div className="flex flex-col space-y-4 bg-secondary/50 p-4 rounded-lg border border-border">
              <ToolBar
                drawingState={drawingState}
                onToolChange={handleToolChange}
                onColorChange={handleColorChange}
                onBrushWidthChange={handleBrushWidthChange}
              />

              <div className="flex items-center space-x-4">
                <Button onClick={handleClearCanvas} variant="outline"
                  className="border-border text-foreground hover:bg-secondary/80">
                  Clear Canvas
                </Button>
                <Button onClick={addPage} variant="outline"
                  className="border-border text-foreground hover:bg-secondary/80">
                  Add Page
                </Button>
                <Button onClick={exportToPDF} variant="outline" 
                  className="border-border text-foreground hover:bg-secondary/80 flex items-center">
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
                <TextRecognition 
                  canvasRef={canvasRef}
                  onTextRecognized={handleTextRecognized}
                />
              </div>
            </div>

            <PageNavigation
              currentPage={currentPage}
              totalPages={pages.length}
              onPageChange={setCurrentPage}
              onRemovePage={removePage}
            />

            <div
              className="relative border border-border rounded-lg bg-background"
              style={{ width: "100%", height: "600px", overflow: "hidden" }}
            >
              <Canvas ref={canvasRef} drawingState={drawingState} setDrawingState={updateCurrentPage} />
              <VideoCall
                stream={stream}
                remoteStreams={remoteStreams}
                onToggleVideo={toggleVideo}
                onToggleAudio={toggleAudio}
                onShareScreen={shareScreen}
                onStopSharing={() => shareScreen()}
                isVideoEnabled={isVideoEnabled}
                isAudioEnabled={isAudioEnabled}
                isScreenSharing={isScreenSharing}
                isFloating={true}
                peerId={peerId}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">Recognized Text</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Below is the text recognized from your handwriting. If the result isn't accurate,
                try writing more clearly or adjusting the contrast.
              </p>
              <div className="bg-secondary/20 rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                  {recognizedText || "No text recognized"}
                </pre>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsTextDialogOpen(false)}
                  className="text-foreground"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(recognizedText);
                    } catch (error) {
                      console.error('Failed to copy text:', error);
                    }
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
