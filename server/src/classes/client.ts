import type { WebRtcTransport, RtpObserver, Producer, Consumer, TransportListenInfo } from 'mediasoup/node/lib/types'
import type { Socket } from 'socket.io'
import { config } from '../config/config'
import type Room from './room' // adjust this if Room is located elsewhere

type DownstreamTransport = {
  transport: WebRtcTransport
  associatedVideoPid: string | null
  associatedAudioPid: string | null
  audio?: Consumer
  video?: Consumer
}

class Client {
  userName: string
  socket: Socket
  upstreamTransport: WebRtcTransport | null = null
  producer: Record<'audio' | 'video', Producer | null> = {
    audio: null,
    video: null
  };
  downstreamTransports: DownstreamTransport[] = []
  room: Room | null = null

  constructor(userName: string, socket: Socket) {
    this.userName = userName
    this.socket = socket
  }

  async addTransport(
    type: 'producer' | 'consumer',
    audioPid: string | null = null,
    videoPid: string | null = null
  ): Promise<{
    id: string | undefined
    iceParameters: WebRtcTransport['iceParameters'] | undefined
    iceCandidates: WebRtcTransport['iceCandidates'] | undefined
    dtlsParameters: WebRtcTransport['dtlsParameters'] | undefined
  }> {
    if (!this.room) throw new Error('Room not assigned to client')
    const { listenIps, initialAvailableOutgoingBitrate } = config.webRtcTransport
    const { maxIncomingBitrate } = config;

    const transport = await this.room.router?.createWebRtcTransport({
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      listenInfos: listenIps as TransportListenInfo[],
      initialAvailableOutgoingBitrate,
    })

    if (maxIncomingBitrate) {
      try {
        await transport?.setMaxIncomingBitrate(maxIncomingBitrate)
      } catch (err) {
        console.error('Error setting maxIncomingBitrate:', err)
      }
    }

    const clientTransportParams = {
      id: transport?.id,
      iceParameters: transport?.iceParameters,
      iceCandidates: transport?.iceCandidates,
      dtlsParameters: transport?.dtlsParameters,
    }

    if (type === 'producer') {
      this.upstreamTransport = transport!
    } else if (type === 'consumer') {
      this.downstreamTransports.push({
        transport: transport!,
        associatedAudioPid: audioPid,
        associatedVideoPid: videoPid,
      })
    }

    return clientTransportParams
  }

  addProducer(kind: 'audio' | 'video', newProducer: Producer) {
    this.producer[kind] = newProducer

    if (kind === 'audio' && this.room) {
      this.room.activeSpeakerObserver.addProducer({
        producerId: newProducer.id,
      })
    }

  }

  addConsumer(kind: 'audio' | 'video', newConsumer: Consumer, downstreamTransport: DownstreamTransport) {
    downstreamTransport[kind] = newConsumer
  }

  // Cleanup method to close all resources when user disconnects
  cleanup() {
    // Close all producers
    if (this.producer.audio) {
      this.producer.audio.close()
      this.producer.audio = null
    }
    if (this.producer.video) {
      this.producer.video.close()
      this.producer.video = null
    }

    // Close all downstream transports and consumers
    this.downstreamTransports.forEach(downstreamTransport => {
      if (downstreamTransport.audio) {
        downstreamTransport.audio.close()
      }
      if (downstreamTransport.video) {
        downstreamTransport.video.close()
      }
      downstreamTransport.transport.close()
    })
    this.downstreamTransports = []

    // Close upstream transport
    if (this.upstreamTransport) {
      this.upstreamTransport.close()
      this.upstreamTransport = null
    }
  }
}

export default Client
