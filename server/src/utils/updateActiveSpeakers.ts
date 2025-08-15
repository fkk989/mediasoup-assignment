import { Server } from "socket.io";
import Room from "../classes/room";

const updateActiveSpeakers = (room: Room, io: Server): Record<string, string[]> => {
    const activeSpeakers = room.activeSpeakerList.slice(0, 5);
    const sepakersToMute = room.activeSpeakerList.slice(5);
    const newTransportsByPeer: Record<string, string[]> = {};

    room.clients.forEach(client => {
        sepakersToMute.forEach(pid => {
            if (client.producer.audio?.id === pid) {
                client.producer.audio.pause();
                client.producer.video?.pause();
                return;
            }
            const downstreamToStop = client.downstreamTransports.find(t => t?.audio?.producerId === pid);
            if (downstreamToStop) {
                downstreamToStop?.audio?.pause();
                downstreamToStop?.video?.pause();
            }
        });

        const newSpeakersToThisClient: string[] = [];

        activeSpeakers.forEach(pid => {
            if (client.producer.audio?.id === pid) {
                client.producer.audio?.resume();
                client.producer.video?.resume();
                return;
            }

            const downstreamToStart = client.downstreamTransports.find(t => t.associatedAudioPid === pid);

            if (downstreamToStart) {
                downstreamToStart?.audio?.resume();
                downstreamToStart?.video?.resume();
            } else {
                // is this user is not consuming 
                newSpeakersToThisClient.push(pid);
            }
        });

        if (newSpeakersToThisClient.length) {
            newTransportsByPeer[client.socket.id] = newSpeakersToThisClient;
        }
    });

    io.to(room.roomName).emit("updateActiveSpeakers", activeSpeakers);

    return newTransportsByPeer;
};

export default updateActiveSpeakers;
