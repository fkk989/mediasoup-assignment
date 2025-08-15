import os from 'os'
import { createWorker, } from 'mediasoup'
import { Worker } from "mediasoup/node/lib/types"
import { config } from '../config/config'

const totalThreads = os.cpus().length

const createWorkers = async (): Promise<Worker[]> => {
    const workers: Worker[] = []

    for (let i = 0; i < totalThreads; i++) {
        const worker = await createWorker(config.workerSettings)

        worker.on('died', () => {
            console.error('Mediasoup worker died — exiting process')
            process.exit(1)
        })

        workers.push(worker)
    }

    return workers
}

export default createWorkers
