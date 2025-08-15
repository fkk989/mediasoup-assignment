"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Video, Eye } from "lucide-react"

export default function HomePage() {
  const [roomId, setRoomId] = useState("")
  const [username, setUsername] = useState("")
  const router = useRouter()

  const isFormValid = roomId.trim() !== "" && username.trim() !== ""

  const handleConnect = () => {
    if (isFormValid) {
      router.push(`/stream?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(username)}`)
    }
  }

  const handleWatch = () => {
    if (roomId.trim() !== "") {
      router.push(`/watch?room=${encodeURIComponent(roomId)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Video className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">StreamConnect</CardTitle>
          <CardDescription>Join a video room or watch an existing stream</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room_id">Room ID</Label>
              <Input
                id="room_id"
                type="text"
                placeholder="Enter room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.trim())}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleConnect}
              disabled={!isFormValid}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              <Video className="w-4 h-4 mr-2" />
              Connect & Stream
            </Button>
            <Button
              onClick={handleWatch}
              disabled={roomId.trim() === ""}
              variant="outline"
              className="w-full h-12 text-base font-medium bg-transparent"
              size="lg"
            >
              <Eye className="w-4 h-4 mr-2" />
              Watch Only
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
