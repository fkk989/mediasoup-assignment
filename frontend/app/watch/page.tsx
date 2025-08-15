"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Volume2, Maximize, ArrowLeft, Users, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import Hls from "hls.js";

export default function WatchPage() {
  const searchParams = useSearchParams();
  const room = searchParams.get("room") || "Unknown";

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState([75]);

  useEffect(() => {
    if (videoRef.current) {
      const hlsUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/hls/${room}/index.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = hlsUrl; // Safari native HLS
      }
    }
  }, [room]);

  const handleGoBack = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button onClick={handleGoBack} variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <Eye className="w-3 h-3 text-white" />
              </div>
              <h1 className="text-lg font-semibold">
                Watching <span className="text-red-400">{room}</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-slate-400">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>LIVE</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>1,234 viewers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="max-w-6xl mx-auto p-4">
        <Card className="relative overflow-hidden bg-slate-900 border-slate-800">
          <div className="aspect-video bg-slate-800 relative group">
            {/* Actual Video */}
            <video
              ref={videoRef}
              controls
              autoPlay
              muted
              style={{ width: "100%", height: "100%" }}
              className="bg-black"
            />

            {/* Live Indicator */}
            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>LIVE</span>
            </div>
          </div>
        </Card>

        {/* Stream Info */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Live Stream - Room {room}</h2>
              <p className="text-slate-400 mt-1">Broadcasting live video content</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-400">1,234</div>
              <div className="text-sm text-slate-500">viewers</div>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-sm text-slate-400">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Connected</span>
            </div>
            <div>Quality: 1080p</div>
            <div>Latency: ~2s</div>
          </div>
        </div>
      </div>
    </div>
  );
}
