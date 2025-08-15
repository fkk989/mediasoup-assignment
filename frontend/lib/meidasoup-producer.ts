import { AppData, Device, Producer, Transport, TransportOptions } from "mediasoup-client/types"
import { Socket } from "socket.io-client"


export const createProducerTransport = (
    socket: Socket,
    device: Device
): Promise<Transport> => {
    return new Promise(async (resolve, reject) => {
        try {
            const producerTransportParams: TransportOptions =
                await socket.emitWithAck("requestTransport", { type: "producer" })

            const producerTransport = device.createSendTransport(producerTransportParams)

            producerTransport.on(
                "connect",
                async (
                    { dtlsParameters },
                    callback,
                    errback
                ) => {
                    try {
                        const connectResp = await socket.emitWithAck("connectTransport", {
                            dtlsParameters,
                            type: "producer",
                        })

                        if (connectResp === "success") {
                            callback()
                        } else {
                            errback(new Error("Failed to connect transport"))
                        }
                    } catch (error) {
                        errback(error instanceof Error ? error : new Error("Unknown error"))
                    }
                }
            )

            producerTransport.on(
                "produce",
                async (
                    parameters,
                    callback,
                    errback,
                ) => {
                    try {
                        console.log("Produce event is now running")

                        const { kind, rtpParameters } = parameters
                        const produceResp = await socket.emitWithAck("startProducing", {
                            kind,
                            rtpParameters,
                        })

                        if (produceResp === "error") {
                            errback(new Error("Failed to produce"))
                        } else {
                            callback({ id: produceResp })
                        }
                    } catch (error) {
                        errback(error instanceof Error ? error : new Error("Unknown error"))
                    }
                }
            )

            resolve(producerTransport)
        } catch (error) {
            reject(error)
        }
    })
}

export const createProducer = (localStream: MediaStream, producerTransport: Transport<AppData>): Promise<{ audio: Producer<AppData>, video: Producer<AppData> }> => {
    return new Promise(async (resolve, reject) => {
        //get the audio and video tracks so we can produce
        const videoTrack = localStream?.getVideoTracks()[0]
        const audioTrack = localStream?.getAudioTracks()[0]

        try {
            // running the produce method, will tell the transport to fire connect event
            // connect event to fire!!
            const videoProducer = await producerTransport.produce({ track: videoTrack })
            const audioProducer = await producerTransport.produce({ track: audioTrack })
            // console.log("finished producing!", audioProducer, videoProducer)
            resolve({ audio: audioProducer, video: videoProducer })
        } catch (err) {
            console.log("error producing: ", err)

        }
    })
}


