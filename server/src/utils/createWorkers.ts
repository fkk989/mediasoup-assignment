import os from 'os'
import { createWorker, } from 'mediasoup'
import { Worker } from "mediasoup/node/lib/types"
import { config } from '../config/config'

const totalThreads = os.cpus().length

export const createWorkers = async () => {
    let workers: Worker[] = []
    for (let i = 0; i < totalThreads; i++) {
        const worker = await createWorker(config.workerSettings)

        workers.push(worker)
    }

    return workers
}

export const createSingleWorker = async () => {
    const worker = await createWorker(config.workerSettings)

    return worker
}


