import type { Worker, Router, ActiveSpeakerObserver, RtpCodecCapability } from 'mediasoup/node/lib/types'
import type { Server as SocketIOServer } from 'socket.io'
import { config } from '../config/config'
import newDominantSpeaker from '../utils/newDominantSpeaker'
import type Client from './client'
class Room {
    roomName: string
    worker: Worker
    router: Router | null = null
    clients: Client[] = []
    activeSpeakerList: string[] = []
    activeSpeakerObserver!: ActiveSpeakerObserver
    constructor(roomName: string, workerToUse: Worker) {
        this.roomName = roomName
        this.worker = workerToUse
    }

    addClient(client: Client) {
        this.clients.push(client)
    }

    removeClient(client: Client) {
        const clientIndex = this.clients.indexOf(client)
        if (clientIndex > -1) {
            this.clients.splice(clientIndex, 1)
        }
    }

    isEmpty(): boolean {
        return this.clients.length === 0
    }

    async cleanup() {
        if (this.activeSpeakerObserver) {
            this.activeSpeakerObserver.close()
        }
        if (this.router) {
            this.router.close()
        }
    }

    removeProducerFromActiveSpeakers(producerId: string) {
        // Remove from active speaker list
        const audioIndex = this.activeSpeakerList.indexOf(producerId)
        if (audioIndex > -1) {
            this.activeSpeakerList.splice(audioIndex, 1)
        }

        // Remove from active speaker observer
        if (this.activeSpeakerObserver) {
            try {
                this.activeSpeakerObserver.removeProducer({
                    producerId: producerId
                })
            } catch (err) {
                console.error('Error removing producer from active speaker observer:', err)
            }
        }
    }

    async createRouter(io: SocketIOServer): Promise<void> {
        this.router = await this.worker.createRouter({
            mediaCodecs: config.routerMediaCodecs as RtpCodecCapability[]
        })

        this.activeSpeakerObserver = await this.router.createActiveSpeakerObserver({
            interval: 300
        })

        // just for testing if createActiveSpeakerObserver is working fine
        // this.activeSpeakerObserver.observer.on("addproducer", (producer) => {
        //     console.log("producerAdded: ", producer.id)
        // })

        this.activeSpeakerObserver.on("dominantspeaker", ds => {
            newDominantSpeaker(ds, this, io)
        })
    }
}

export default Room
