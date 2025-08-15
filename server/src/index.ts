import http from 'http'
import express from 'express'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { Worker } from 'mediasoup/node/lib/types'
import { RtpCapabilities, RtpParameters } from 'mediasoup/node/lib/types'
import { createSingleWorker, createWorkers } from './utils/createWorkers'
import getWorker from './utils/getWorker'
import updateActiveSpeakers from './utils/updateActiveSpeakers'
import Client from './classes/client'
import Room from './classes/room'
import cors from "cors"
import path from "path"

const app = express()


app.use("/hls", express.static(path.join(process.cwd(), "public", "hls")));

const httpServer = http.createServer(app)

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*"
    }
})

let workers: Worker[] = []
const rooms: Room[] = []

const initMediaSoup = async () => {
    workers = await createWorkers()

    workers.forEach((worker, index) => {
        worker.on('died', async () => {
            console.error(`Mediasoup worker at index ${index} died. Restarting...`);

            const newWorker = await createSingleWorker();

            workers[index] = newWorker;

            console.log(`Mediasoup worker at index ${index} restarted successfully.`);
        });
    });
}

initMediaSoup()

io.on('connection', (socket: Socket) => {
    let client: Client

    socket.data.client = undefined;

    socket.on('joinRoom', async ({ userName, roomName }: { userName: string; roomName: string }, ackCb) => {
        let newRoom = false
        client = new Client(userName, socket)
        socket.data.client = client;

        let requestedRoom = rooms.find(room => room.roomName === roomName)
        console.log("user: ", userName, "room:", roomName)
        roomName = roomName.trim()
        if (!requestedRoom) {
            console.log("no room found")
            newRoom = true
            const workerToUse = await getWorker(workers)
            requestedRoom = new Room(roomName, workerToUse)
            await requestedRoom.createRouter(io)
            rooms.push(requestedRoom)
        }


        client.room = requestedRoom
        client.room.addClient(client)
        socket.join(client.room.roomName)

        const audioPidsToCreate = client.room.activeSpeakerList.slice(0, 5)
        const videoPidsToCreate = audioPidsToCreate.map(aid => {
            const producingClient = client.room?.clients.find(c => c?.producer?.audio?.id === aid)
            return producingClient?.producer?.video?.id
        })
        const associatedUserNames = audioPidsToCreate.map(aid => {
            const producingClient = client.room?.clients.find(c => c?.producer?.audio?.id === aid)
            return producingClient?.userName
        })

        ackCb({
            routerRtpCapabilities: client.room.router?.rtpCapabilities,
            newRoom,
            audioPidsToCreate,
            videoPidsToCreate,
            associatedUserNames
        })
    })

    socket.on('requestTransport', async ({ type, audioPid }: { type: 'producer' | 'consumer'; audioPid?: string }, ackCb) => {
        let clientTransportParams
        if (type === 'producer') {

            clientTransportParams = await client.addTransport(type)
        } else {
            const producingClient = client.room?.clients.find(c => c?.producer?.audio?.id === audioPid)
            const videoPid = producingClient?.producer?.video?.id
            clientTransportParams = await client.addTransport(type, audioPid, videoPid)
        }
        ackCb(clientTransportParams)
    })

    socket.on('connectTransport', async ({ dtlsParameters, type, audioPid }, ackCb) => {
        try {
            if (type === 'producer') {

                await client.upstreamTransport?.connect({ dtlsParameters })
            } else {
                const downstreamTransport = client.downstreamTransports.find(t => t.associatedAudioPid === audioPid)
                downstreamTransport?.transport.connect({ dtlsParameters })
            }
            ackCb('success')
        } catch (error) {
            console.error(error)
            ackCb('error')
        }
    })

    socket.on('startProducing', async ({ kind, rtpParameters }: { kind: 'audio' | 'video'; rtpParameters: RtpParameters }, ackCb) => {
        try {
            const newProducer = await client.upstreamTransport?.produce({ kind, rtpParameters })
            client.addProducer(kind, newProducer!)
            if (kind === 'audio') {
                client.room?.activeSpeakerList.push(newProducer?.id as string)
            }
            ackCb(newProducer?.id)
        } catch (err) {
            console.error(err)
            ackCb(err)
        }

        const newTransportsByPeer = updateActiveSpeakers(client.room as Room, io)
        for (const [socketId, audioPidsToCreate] of Object.entries(newTransportsByPeer)) {

            const videoPidsToCreate: string[] = [];
            const associatedUserNames: string[] = []
            audioPidsToCreate.forEach(aPid => {

                const producerClient = client.room?.clients.find(c => c?.producer?.audio?.id === aPid)
                videoPidsToCreate.push(producerClient?.producer?.video?.id as string)

                associatedUserNames.push(producerClient?.userName as string)
            })

            io.to(socketId).emit('newProducersToConsume', {
                routerRtpCapabilities: client.room?.router?.rtpCapabilities,
                audioPidsToCreate,
                videoPidsToCreate,
                associatedUserNames,
                activeSpeakerList: client.room?.activeSpeakerList.slice(0, 5)
            })
        }
    })

    socket.on('audioChange', (typeOfChange: 'mute' | 'unmute') => {
        if (typeOfChange === 'mute') {
            client?.producer?.audio?.pause()
        } else {
            client?.producer?.audio?.resume()
        }
    })

    socket.on('consumeMedia', async ({ rtpCapabilities, pid, kind }: { rtpCapabilities: RtpCapabilities; pid: string; kind: 'audio' | 'video' }, ackCb) => {
        try {
            if (!client.room?.router?.canConsume({ producerId: pid, rtpCapabilities })) {
                ackCb('cannotConsume')
                return
            }
            const downstreamTransport = client.downstreamTransports.find(t => {
                return kind === 'audio' ? t.associatedAudioPid === pid : t.associatedVideoPid === pid
            })
            const newConsumer = await downstreamTransport!.transport.consume({
                producerId: pid,
                rtpCapabilities,
                paused: true
            })
            client.addConsumer(kind, newConsumer, downstreamTransport!)
            const clientParams = {
                producerId: pid,
                id: newConsumer.id,
                kind: newConsumer.kind,
                rtpParameters: newConsumer.rtpParameters
            }
            ackCb(clientParams)
        } catch (err) {
            console.error(err)
            ackCb('consumeFailed')
        }
    })

    socket.on('unpauseConsumer', async ({ pid, kind }: { pid: string; kind: 'audio' | 'video' }, ackCb) => {
        const consumerToResume = client.downstreamTransports.find(t => t?.[kind]?.producerId === pid)
        await consumerToResume?.[kind]?.resume()
        ackCb()
    })

    // Handle voluntary room leaving
    socket.on('leaveRoom', async (ackCb) => {
        if (client && client.room) {
            console.log(`User ${client.userName} leaving room ${client.room.roomName}`)

            // Remove from active speaker list and observer before cleanup
            if (client.producer.audio) {
                client.room.removeProducerFromActiveSpeakers(client.producer.audio.id)
            }

            // Cleanup all client resources
            client.cleanup()

            // Remove client from room
            client.room.removeClient(client)

            // Leave the socket room
            socket.leave(client.room.roomName)

            // Notify other clients about the user leaving
            socket.to(client.room.roomName).emit('userLeft', {
                userName: client.userName,
                activeSpeakerList: client.room.activeSpeakerList.slice(0, 5)
            })

            // Clean up empty rooms
            if (client.room.isEmpty()) {
                console.log(`Room ${client.room.roomName} is empty, cleaning up...`)
                await client.room.cleanup()
                const roomIndex = rooms.indexOf(client.room)
                if (roomIndex > -1) {
                    rooms.splice(roomIndex, 1)
                }
                console.log(`Room ${client.room.roomName} cleaned up`)
            }

            // Clear client reference
            client.room = null
            socket.data.client = undefined

            ackCb({ success: true })
        } else {
            ackCb({ success: false, error: 'No room to leave' })
        }
    })

    // Handle disconnect event
    socket.on('disconnect', async () => {
        if (client && client.room) {
            console.log(`User ${client.userName} disconnected from room ${client.room.roomName}`)

            // Remove from active speaker list and observer before cleanup
            if (client.producer.audio) {
                client.room.removeProducerFromActiveSpeakers(client.producer.audio.id)
            }

            // Cleanup all client resources
            client.cleanup()

            // Remove client from room
            client.room.removeClient(client)

            // Notify other clients about the disconnection
            socket.to(client.room.roomName).emit('userDisconnected', {
                userName: client.userName,
                activeSpeakerList: client.room.activeSpeakerList.slice(0, 5)
            })

            // Clean up empty rooms
            if (client.room.isEmpty()) {
                console.log(`Room ${client.room.roomName} is empty, cleaning up...`)
                await client.room.cleanup()
                const roomIndex = rooms.indexOf(client.room)
                if (roomIndex > -1) {
                    rooms.splice(roomIndex, 1)
                }
                console.log(`Room ${client.room.roomName} cleaned up`)
            }
        }
    })
})

// health check route
app.get("/health", (req, res) => {
    res.send("Working fine")
})

httpServer.listen(process.env.PORT || 8080, () => {
    console.log(`http://localhost:${process.env.PORT || 8080}`)
})
