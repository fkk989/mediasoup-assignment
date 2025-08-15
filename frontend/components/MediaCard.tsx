"use client"
import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card' // adjust path based on your project

interface MediaCardProps {
    username: string
    stream: MediaStream | null
    mute: boolean
}

const MediaCard: React.FC<MediaCardProps> = ({
    username,
    stream,
    mute

}) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream || null
        }
        return () => {
            if (videoRef.current) {
                videoRef.current.srcObject = null
            }
        }
    }, [stream])

    return (
        <Card className="w-full bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors flex-shrink-0 overflow-hidden rounded-lg relative">
            {stream ? (
                <div className="relative w-full h-full">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={mute}
                        className="aspect-video w-full h-auto object-cover"
                    />
                    {/* Username overlay */}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm select-none">
                        {username}
                    </div>
                </div>
            ) : (
                <div className="aspect-video bg-slate-700 flex items-center justify-center relative">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center text-sm font-bold text-white mb-2">
                            {username}
                        </div>
                        <p className="text-sm font-medium text-white">{username}</p>
                    </div>
                    <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                </div>
            )}
        </Card>
    )
}

export default MediaCard
