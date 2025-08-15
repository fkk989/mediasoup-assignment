import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from "socket.io-client"
import { Device } from 'mediasoup-client'
import { AppData, Producer, Transport } from 'mediasoup-client/types'
import { createProducerTransport, createProducer } from '@/lib/meidasoup-producer'
import { ConsumerData, JoinRoomPayload, JoinRoomResponse, UseMediasoupProp } from '@/lib/types'
import { requestTransportToConsume } from '@/lib/mediasoup-consumer'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080'

export type ActiveSpeakersType = { [key: string]: ConsumerData }

export const useMediasoup = ({ roomName, userName, localStream, mute, cameraEnabled }: UseMediasoupProp) => {
    console.log("useMediasoup ran...")
    const [activeSpeakers, setActiveSpeakers] = useState<ActiveSpeakersType>({});
    const activeSpeakersRef = useRef<ActiveSpeakersType>({});
    const [sequenceOfSpeakers, setSequenceOfSpeakers] = useState<string[]>([])
    const socketRef = useRef<Socket | null>(null)
    const deviceRef = useRef<Device>(null)
    const [isDeviceLoded, setIsDeviceLoaded] = useState(false)
    const producerTransport = useRef<Transport<AppData>>(null)
    const audioProducer = useRef<Producer<AppData>>(null)
    const videoProducer = useRef<Producer<AppData>>(null)
    const isProducing = useRef(false)
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLeaving, setIsLeaving] = useState(false)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const maxReconnectAttempts = 5



    // Cleanup function for producers and transports
    const cleanupProducers = useCallback(async () => {
        try {
            if (audioProducer.current) {
                audioProducer.current.close()
                audioProducer.current = null
            }
            if (videoProducer.current) {
                videoProducer.current.close()
                videoProducer.current = null
            }
            if (producerTransport.current) {
                producerTransport.current.close()
                producerTransport.current = null
            }
            isProducing.current = false
        } catch (err) {
            console.error('Error cleaning up producers:', err)
            // Continue cleanup even if there's an error
            audioProducer.current = null
            videoProducer.current = null
            producerTransport.current = null
            isProducing.current = false
        }
    }, [])

    // Cleanup function for consumers and active speakers
    const cleanupConsumers = useCallback(() => {
        try {
            // Close all active speaker streams
            Object.values(activeSpeakersRef.current).forEach(speaker => {
                try {
                    if (speaker.audioConsumer) {
                        speaker.audioConsumer.close()
                    }
                    if (speaker.videoConsumer) {
                        speaker.videoConsumer.close()
                    }
                } catch (err) {
                    console.error('Error closing consumer:', err)
                }
            })

            setActiveSpeakers({})
            activeSpeakersRef.current = {}
            setSequenceOfSpeakers([])
        } catch (err) {
            console.error('Error cleaning up consumers:', err)
            // Force cleanup even if there's an error
            setActiveSpeakers({})
            activeSpeakersRef.current = {}
            setSequenceOfSpeakers([])
        }
    }, [])

    const leaveRoom = useCallback(async () => {
        // stopping local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (!socketRef.current || isLeaving) return

        setIsLeaving(true)
        try {
            // Cleanup producers first
            await cleanupProducers()

            // Cleanup consumers
            cleanupConsumers()

            // Leave room on server
            if (socketRef.current) {
                try {
                    await socketRef.current.emitWithAck('leaveRoom')
                } catch (err) {
                    console.error('Error leaving room on server:', err)
                    // Continue with cleanup even if server call fails
                }
            }

            // Reset device
            if (deviceRef.current) {
                deviceRef.current = null
                setIsDeviceLoaded(false)
            }

        } catch (err) {
            console.error('Error leaving room:', err)
            setError('Failed to leave room')
        } finally {
            setIsLeaving(false)
        }
    }, [cleanupProducers, cleanupConsumers, isLeaving, localStream])

    // pause or resume audio producer
    useEffect(() => {
        if (mute) {
            localStream?.getAudioTracks().forEach(track => track.enabled = false);
            audioProducer.current?.pause()
        } else {
            localStream?.getAudioTracks().forEach(track => track.enabled = true);
            audioProducer.current?.resume()
        }
    }, [mute, localStream])

    // pause or resume video producer
    useEffect(() => {
        if (cameraEnabled) {
            localStream?.getVideoTracks().forEach(track => track.enabled = true);
            videoProducer.current?.resume()
        } else {
            localStream?.getVideoTracks().forEach(track => track.enabled = false);
            videoProducer.current?.pause()
        }
    }, [cameraEnabled, localStream])

    const initDevice = useCallback(async (routerRtpCapabilities: any) => {
        if (!deviceRef.current) {
            try {
                const device = new Device()
                await device.load({ routerRtpCapabilities })
                deviceRef.current = device
                setIsDeviceLoaded(true)
                setError(null)
                console.log("Device loaded")
                return device
            } catch (err) {
                console.error('Error loading device:', err)
                setError('Failed to initialize media device')
                throw err
            }
        }
        return deviceRef.current
    }, [])

    const joinRoom = useCallback(async (payload: JoinRoomPayload) => {
        try {
            const res = await socketRef.current!.emitWithAck('joinRoom', payload) as JoinRoomResponse
            console.log("join room response: ", res)
            const device = await initDevice(res.routerRtpCapabilities)

            if (device && socketRef.current) {
                console.log("requestTransportToConsume.....")
                requestTransportToConsume({
                    consumeData: {
                        audioPidsToCreate: res.audioPidsToCreate,
                        videoPidsToCreate: res.videoPidsToCreate,
                        associatedUserNames: res.associatedUserNames
                    },
                    socket: socketRef.current,
                    device: device,
                    setActiveSpeakers,
                    activeSpeakersRef,
                    setSequenceOfSpeakers
                })
            }
        } catch (err) {
            console.error('Error joining room:', err)
            setError('Failed to join room')
        }
    }, [roomName, userName, initDevice])

    // Reconnection function
    const attemptReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setError('Failed to reconnect after multiple attempts. Please refresh the page.')
            return
        }

        reconnectAttemptsRef.current++
        console.log(`Attempting to reconnect... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)

        // Clear existing socket
        if (socketRef.current) {
            socketRef.current.disconnect()
            socketRef.current = null
        }

        // Attempt to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
            if (socketRef.current) return // Already reconnected

            const newSocket = io(SOCKET_URL, {
                transports: ['websocket'],
            })

            socketRef.current = newSocket

            // Set up event listeners for the new socket
            newSocket.on('connect', () => {
                setConnected(true)
                setError(null)
                reconnectAttemptsRef.current = 0
                console.log('Reconnected to socket server')

                // Rejoin room if we were in one
                if (deviceRef.current && localStream) {
                    joinRoom({ roomName, userName })
                }
            })

            newSocket.on('connect_error', (err) => {
                console.error('Reconnection failed:', err)
                setError('Reconnection failed')
                // Try again
                attemptReconnect()
            })
        }, Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)) // Exponential backoff with max 10s
    }, [roomName, userName, localStream, joinRoom])

    // connecting socket
    useEffect(() => {
        let socket = io(SOCKET_URL, {
            transports: ['websocket'],
        })

        if (!socketRef.current) socketRef.current = socket

        socket.on('connect', () => {
            setConnected(true)
            setError(null)
            console.log('Connected to socket server')
        })

        socket.on('updateActiveSpeakers', async (newListOfActives: string[]) => {
            newListOfActives = newListOfActives.filter((audio_id) => audioProducer.current?.id !== audio_id)
            console.log("newnewListOfActives: ", newListOfActives)

            setSequenceOfSpeakers((pre) => {
                return [...new Set(newListOfActives)]
            })
        })

        socket.on('newProducersToConsume', consumeData => {
            console.log("newProducersToConsume consumeData: ", consumeData)
            if (deviceRef.current) {
                requestTransportToConsume({
                    consumeData,
                    socket,
                    device: deviceRef.current,
                    setActiveSpeakers,
                    activeSpeakersRef,
                    setSequenceOfSpeakers
                })
            }
        })

        // Handle user disconnections
        socket.on('userDisconnected', (data: { userName: string; activeSpeakerList: string[] }) => {
            console.log(`User ${data.userName} disconnected`)
            // Update active speakers list
            setSequenceOfSpeakers(data.activeSpeakerList)
            // Clean up disconnected user's streams
            setActiveSpeakers(prev => {
                const newSpeakers = { ...prev }
                Object.keys(newSpeakers).forEach(key => {
                    if (newSpeakers[key].userName === data.userName) {
                        delete newSpeakers[key]
                    }
                })
                return newSpeakers
            })
        })

        // Handle users voluntarily leaving
        socket.on('userLeft', (data: { userName: string; activeSpeakerList: string[] }) => {
            console.log(`User ${data.userName} left the room`)
            // Update active speakers list
            setSequenceOfSpeakers(data.activeSpeakerList)
            // Clean up left user's streams
            setActiveSpeakers(prev => {
                const newSpeakers = { ...prev }
                Object.keys(newSpeakers).forEach(key => {
                    if (newSpeakers[key].userName === data.userName) {
                        delete newSpeakers[key]
                    }
                })
                return newSpeakers
            })
        })

        socket.on('disconnect', () => {
            setConnected(false)
            setError('Connection lost')
            console.log('Disconnected from socket server')

            // Attempt to reconnect
            attemptReconnect()
        })

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err)
            setError('Failed to connect to server')
        })

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [])

    // joining room
    useEffect(() => {
        if (localStream && connected && !deviceRef.current) {
            joinRoom({ roomName, userName })
        }
    }, [connected, roomName, userName, localStream, joinRoom])

    // creating producer transport and setting it to producer ref
    const initProducer = useCallback(async () => {
        try {
            if (!isProducing.current && isDeviceLoded && socketRef.current && deviceRef.current && localStream) {
                producerTransport.current = await createProducerTransport(socketRef.current, deviceRef.current)

                isProducing.current = true
                const { audio, video } = await createProducer(localStream, producerTransport.current)

                videoProducer.current = video;
                audioProducer.current = audio
            }
        } catch (error) {
            console.log("Error producing", error)
            setError('Failed to start media stream')
        }
    }, [localStream, isDeviceLoded])

    useEffect(() => {
        initProducer()
    }, [isDeviceLoded, localStream, initProducer])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupProducers()
            cleanupConsumers()
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
        }
    }, [cleanupProducers, cleanupConsumers])

    return {
        socket: socketRef.current,
        connected,
        joinRoom,
        leaveRoom,
        producerTransport,
        device: deviceRef.current,
        activeSpeakers,
        sequenceOfSpeakers,
        error,
        isLeaving
    }
}
