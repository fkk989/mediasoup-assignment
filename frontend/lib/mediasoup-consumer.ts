import { AppData, Consumer, Device, MediaKind, Transport, TransportOptions } from "mediasoup-client/types"
import { Dispatch, RefObject, SetStateAction } from "react"
import { Socket } from "socket.io-client"
import { ConsumerData } from "./types"
import { ActiveSpeakersType } from "@/hooks/useMediasoup"

export const createConsumerTransport = ({ device, transportParams, socket, audioPid }: { transportParams: TransportOptions, device: Device, socket: Socket, audioPid: string }) => {
    // make a downstream transport for ONE producer/peer/client (with audio and video producers)
    const consumerTransport = device.createRecvTransport(transportParams)
    consumerTransport.on('connectionstatechange', state => {
        console.log("==connectionstatechange==")
        console.log(state)
    })
    consumerTransport.on('icegatheringstatechange', state => {
        console.log("==icegatheringstatechange==")
        console.log(state)
    })

    let isConnected = false
    // transport connect listener... fires on .consume()
    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        if (isConnected) return callback()
        isConnected = true
        console.log("Transport connect event has fired!")

        const connectResp = await socket.emitWithAck('connectTransport', { dtlsParameters, type: "consumer", audioPid })
        console.log(connectResp, "connectResp is back!")
        if (connectResp === "success") {
            callback() //this will finish our await consume
        } else {
            errback(new Error("Error connecting consumer transport"))
        }
    })
    return consumerTransport
}

export const createConsumer = ({ consumerTransport, pid, device, kind, socket }: { consumerTransport: Transport<AppData>; pid: string; device: Device; socket: Socket, kind: MediaKind }): Promise<Consumer<AppData>> => {
    return new Promise(async (resolve, reject) => {
        // consume from the basics, emit the consumeMedia event, we take
        // the params we get back, and run .consume(). That gives us our track
        const consumerParams = await socket.emitWithAck('consumeMedia', { rtpCapabilities: device.rtpCapabilities, pid, kind })

        if (consumerParams === "cannotConsume") {
            console.log("Cannot consume")
            reject(new Error("Cannot consume"))
        } else if (consumerParams === "consumeFailed") {
            console.log("Consume failed...")
            reject(new Error("Failed to consume"))
        } else {
            // we got valid params! Use them to consume
            const consumer = await consumerTransport.consume(consumerParams)
            console.log("consume() has finished")
            const { track } = consumer
            // add track events
            //unpause
            await socket.emitWithAck('unpauseConsumer', { pid, kind })
            resolve(consumer)
        }
    })
}

export const requestTransportToConsume = async ({ consumeData, socket, device, setActiveSpeakers, activeSpeakersRef, setSequenceOfSpeakers }: { consumeData: { audioPidsToCreate: string[], videoPidsToCreate: string[], associatedUserNames: string[] }, socket: Socket, device: Device, setActiveSpeakers: Dispatch<ActiveSpeakersType>, activeSpeakersRef: RefObject<ActiveSpeakersType>, setSequenceOfSpeakers: Dispatch<SetStateAction<string[]>> }) => {

    consumeData.audioPidsToCreate.map(async (audioPid, i) => {
        const videoPid = consumeData.videoPidsToCreate[i];
        const consumerTransportParams = await socket.emitWithAck('requestTransport', { type: "consumer", audioPid });
        const consumerTransport = createConsumerTransport({ transportParams: consumerTransportParams, device, socket, audioPid });

        const [audioConsumer, videoConsumer] = await Promise.all([
            createConsumer({ consumerTransport, pid: audioPid, device, socket, kind: 'audio' }),
            createConsumer({ consumerTransport, pid: videoPid, device, socket, kind: 'video' })
        ]);

        const combinedStream = new MediaStream([audioConsumer?.track, videoConsumer?.track]);

        const speakerData = {
            combinedStream,
            userName: consumeData.associatedUserNames[i],
            consumerTransport,
            audioConsumer,
            videoConsumer
        } as ConsumerData

        activeSpeakersRef.current[audioPid] = speakerData

        setSequenceOfSpeakers(pre => [...pre, ...new Set(audioPid)])
        // @ts-ignore
        setActiveSpeakers((pre) => {
            return { ...pre, [audioPid]: speakerData }
        });

    })

};



