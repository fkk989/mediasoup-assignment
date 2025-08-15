import { Producer } from 'mediasoup/node/lib/types'
import { Server as SocketIOServer } from 'socket.io'
import updateActiveSpeakers from './updateActiveSpeakers'
import type Room from '../classes/room'
import type Client from '../classes/client'

interface DominantSpeakerEvent {
    producer: Producer
}

const newDominantSpeaker = (
    ds: DominantSpeakerEvent,
    room: Room,
    io: SocketIOServer
): void => {
    console.log('- New DS - ( ', ds.producer.id, ' ) - in room - ', room.roomName)

    const index = room.activeSpeakerList.findIndex(pid => pid === ds.producer.id)

    if (index > -1) {
        const [pid] = room.activeSpeakerList.splice(index, 1)
        room.activeSpeakerList.unshift(pid)
    } else {
        room.activeSpeakerList.unshift(ds.producer.id)
    }

    console.log(room.activeSpeakerList)

    const newTransportsByPeer = updateActiveSpeakers(room, io)

    for (const [socketId, audioPidsToCreate] of Object.entries(newTransportsByPeer)) {
        const videoPidsToCreate = audioPidsToCreate.map(aPid => {
            const producerClient = room.clients.find(
                c => (c as Client)?.producer?.audio?.id === aPid
            )
            return producerClient?.producer?.video?.id
        })

        const associatedUserNames = audioPidsToCreate.map(aPid => {
            const producerClient = room.clients.find(
                c => (c as Client)?.producer?.audio?.id === aPid
            )
            return producerClient?.userName
        })

        io.to(socketId).emit('newProducersToConsume', {
            routerRtpCapabilities: room.router!.rtpCapabilities,
            audioPidsToCreate,
            videoPidsToCreate,
            associatedUserNames,
            activeSpeakerList: room.activeSpeakerList.slice(0, 5)
        })
    }
}

export default newDominantSpeaker
