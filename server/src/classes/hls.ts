import { PlainTransport } from "mediasoup/node/lib/PlainTransportTypes";
import Room from "./room"
import { Consumer } from "mediasoup/node/lib/ConsumerTypes";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";

type MediaPipeline = {
    who: string;
    v?: { transport: PlainTransport; consumer: Consumer; port: number; sdpPath: string };
    a?: { transport: PlainTransport; consumer: Consumer; port: number; sdpPath: string };
    hasVideo: boolean;
    hasAudio: boolean;
};
class HlsManger {
    room: Room
    mediaPipelines: MediaPipeline[] = []
    nextPort = 5004;
    constructor(room: Room) {
        this.room = room;
    }

    async startHls() {
        try {
            // Clean any previous run
            // TODO:create a stop function to stop all previous running process
            // await this.stop();
            const top5ActiveSpeakers = this.room.activeSpeakerList.slice(0, 5);
            const clientToCreateProducer = this.room.clients.filter(({ producer }) => top5ActiveSpeakers.includes(producer.audio?.id || ""))

            if (clientToCreateProducer.length === 0) {
                console.log("HLS - No Active speaker")
                return;
            }

            for (const client of clientToCreateProducer) {
                const audioProducer = client.producer?.audio
                const videoProducer = client.producer?.video

                if (videoProducer) {
                    const videoPort = this.allocPort();
                    const videoTransport = await this.room.router?.createPlainTransport({
                        listenIp: { ip: '127.0.0.1' },
                        rtcpMux: true,
                        comedia: false
                    });
                    videoTransport?.connect({
                        ip: "127.0.0.1",
                        port: videoPort
                    })

                    const videoConsumer = await videoTransport?.consume({
                        producerId: client.producer?.video?.id || "",
                        rtpCapabilities: this.room?.router?.rtpCapabilities as RtpCapabilities
                    });

                    await videoConsumer?.resume();
                }

                if (audioProducer) {
                    const audioPort = this.allocPort();

                    const audioTransport = await this.room.router?.createPlainTransport({
                        listenIp: { ip: '127.0.0.1' },
                        rtcpMux: true,
                        comedia: false
                    });
                    audioTransport?.connect({
                        ip: "127.0.0.1",
                        port: audioPort
                    })

                    const audioConsumer = await audioTransport?.consume({
                        producerId: client.producer?.audio?.id || "",
                        rtpCapabilities: this.room?.router?.rtpCapabilities as RtpCapabilities
                    });

                    await audioConsumer?.resume();
                }

            }

            console.log("Hls started Cos")
        } catch (error) {
            console.error("Error starting hls: ", error)
        }
    }

    private allocPort() {
        const p = this.nextPort;
        this.nextPort += 2; // step by 2 to keep even/odd spacing if you later use rtcpMux=false
        return p;
    }
}

export default HlsManger