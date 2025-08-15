"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, AlertCircle, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import clsx from "clsx"
import MediaCard from "@/components/MediaCard"
import {
  useMediasoup
} from "@/hooks/useMediasoup"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

export default function StreamPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const room = searchParams.get("room") || "Unknown"
  const username = searchParams.get("username") || "User"
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [mute, setMute] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const {
    activeSpeakers,
    sequenceOfSpeakers,
    leaveRoom,
    error: hookError,
    isLeaving,
    connected
  } = useMediasoup({
    roomName: room,
    userName: username,
    localStream,
    mute,
    cameraEnabled
  })

  // Show toast notifications for connection status
  useEffect(() => {
    if (connected) {
      toast({
        itemID: "connection-success",
        title: "Connected",
        description: `Successfully connected to room ${room}`,
        duration: 3000,
      })
    }
  }, [connected, room, toast])

  // Show toast for errors
  useEffect(() => {
    if (hookError) {
      toast({
        itemID: "connection-error",
        title: "Connection Error",
        description: hookError,
        variant: "destructive",
        duration: 5000,
        style: {
          color: "white"
        }
      })
    }
  }, [hookError, toast])

  // Handle media access errors
  const handleMediaError = useCallback((error: string) => {
    setMediaError(error)
    setIsLoading(false)
    toast({
      title: "Media Access Error",
      description: error,
      variant: "destructive",
      duration: 5000,
    })
  }, [toast])

  const handleLeaveRoom = useCallback(async () => {
    try {
      await leaveRoom()
      // Stop local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        setLocalStream(null)
      }
      // Show success toast
      toast({
        title: "Left Room",
        description: "Successfully left the room",
        duration: 3000,
      })
      // Redirect to home page
      router.push('/')
    } catch (error) {
      console.error('Error leaving room:', error)
      toast({
        title: "Error",
        description: "Failed to leave room properly",
        variant: "destructive",
        duration: 3000,
      })
      // Force redirect even if there's an error
      router.push('/')
    }
  }, [leaveRoom, localStream, router, toast])

  // Handle page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [localStream])


  const getUserMedia = useCallback(async () => {
    try {
      setIsLoading(true)
      setMediaError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      setLocalStream(stream)
      setIsLoading(false)

      toast({
        itemID: "media-access-granted",
        title: "Media Access Granted",
        description: "Camera and microphone are now active",
        duration: 3000,
      })
    } catch (error: any) {
      console.error('Error accessing media devices:', error)
      let errorMessage = 'Failed to access camera/microphone'

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera and microphone access denied. Please allow access and refresh the page.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please check your devices.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.'
      }

      handleMediaError(errorMessage)
    }
  }, [handleMediaError, toast])

  useEffect(() => {
    getUserMedia()
  }, [getUserMedia])

  // Show error if hook has error
  useEffect(() => {
    if (hookError) {
      setMediaError(hookError)
    }
  }, [hookError])

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg">Initializing media devices...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (mediaError) {
    return (
      <div className="h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="max-w-md mx-auto p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{mediaError}</AlertDescription>
          </Alert>
          <div className="space-y-3">
            <Button
              onClick={() => window.location.reload()}
              className="w-full cursor-pointer"
            >
              Try Again
            </Button>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full text-black cursor-pointer"
            >
              Go Back Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col">
      {/* Header - Fixed height */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">
                Connected to room <span className="text-green-400">{room}</span> as{" "}
                <span className="text-green-400">{username}</span>
              </h1>
              <div className="flex items-center space-x-2 text-sm">
                <div className={clsx(
                  "w-2 h-2 rounded-full",
                  connected ? "bg-green-500" : "bg-red-500"
                )} />
                <span className={connected ? "text-green-400" : "text-red-400"}>
                  {connected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-400">
            {Object.keys(activeSpeakers).length + 1} participants
          </div>
        </div>
      </div>

      {/* Main Content - Flexible height */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto p-4 h-full">
          {/* Side-by-side Video Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Dominant Speaker - Left Side */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              <h2 className="text-xl font-semibold flex items-center mb-3 flex-shrink-0">
                <Video className="w-5 h-5 mr-2 text-primary" />
                Dominant Speaker
              </h2>

              {sequenceOfSpeakers[0] && (
                <MediaCard
                  stream={activeSpeakers[sequenceOfSpeakers[0]]?.combinedStream}
                  mute={false}
                  username={activeSpeakers[sequenceOfSpeakers[0]]?.userName}
                />
              )}
            </div>

            {/* Active Speakers - Right Side */}
            <div className="flex flex-col min-h-0">
              <h2 className="text-xl font-semibold flex items-center mb-3 flex-shrink-0">
                <Users className="w-5 h-5 mr-2 text-slate-400" />
                Active Speakers
              </h2>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2">
                {sequenceOfSpeakers.slice(1).map((audio_id) => {
                  if (activeSpeakers[audio_id]) {
                    return (
                      <MediaCard
                        key={`${Date.now()}`}
                        stream={activeSpeakers[audio_id].combinedStream}
                        mute={false}
                        username={activeSpeakers[audio_id].userName}
                      />
                    )
                  }
                  return <></>
                })}
                <MediaCard stream={localStream} mute={mute} username={"You"} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 border-t border-slate-700 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-center space-x-4">
          {/* audio control */}
          <div className="flex flex-col items-center justify-center gap-[10px]">
            <Button
              onClick={() => setMute((pre) => !pre)}
              variant={mute ? "destructive" : "default"}
              size="lg"
              className="w-14 h-14 rounded-full"
              disabled={!connected}
            >
              {mute ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <span className={clsx(mute ? "text-slate-400" : "")}>
              {mute ? "Mic Off" : "Mic On"}
            </span>
          </div>
          {/* video control */}
          <div className="flex flex-col items-center justify-center gap-[10px]">
            <Button
              onClick={() => {
                setCameraEnabled(pre => !pre)
              }}
              variant={cameraEnabled ? "default" : "destructive"}
              size="lg"
              className="w-14 h-14 rounded-full"
              disabled={!connected}
            >
              {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            <span className={clsx(cameraEnabled ? "" : "text-slate-400")}>
              {cameraEnabled ? "Camera On" : "Camera Off"}
            </span>
          </div>
          {/* leave room control */}
          <div className="flex flex-col items-center justify-center gap-[10px]">
            <Button
              onClick={handleLeaveRoom}
              variant="destructive"
              size="lg"
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700"
              disabled={isLeaving}
            >
              {isLeaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PhoneOff className="w-5 h-5" />
              )}
            </Button>
            <span>{isLeaving ? "Leaving..." : "Leave Room"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
