import { AppData, Consumer } from "mediasoup-client/types";
import { Dispatch, SetStateAction } from "react";

export interface JoinRoomPayload {
    userName: string
    roomName: string
}

export type UseMediasoupProp = JoinRoomPayload & {
    localStream: MediaStream | null;
    mute: boolean;
    cameraEnabled: boolean;
}

export interface JoinRoomResponse {
    routerRtpCapabilities: any
    newRoom: boolean
    audioPidsToCreate: string[]
    videoPidsToCreate: string[]
    associatedUserNames: string[]
}

export type ConsumerData = {
    audioPid: string
    combinedStream: MediaStream;
    userName: string;
    consumerTransport: any;
    audioConsumer: Consumer<AppData>;
    videoConsumer: Consumer<AppData>;
};
export type MediaKind = 'audio' | 'video'
