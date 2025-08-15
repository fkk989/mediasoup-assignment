import type { Worker } from 'mediasoup/node/lib/types'

const getWorker = async (workers: Worker[]): Promise<Worker> => {
    const workersLoadPromises = workers.map(async (worker) => {
        const stats = await worker.getResourceUsage()
        // Calculate CPU usage (user time + system time)
        const cpuUsage = stats.ru_utime + stats.ru_stime
        return cpuUsage
    })

    const workersLoad = await Promise.all(workersLoadPromises)

    let leastLoadedWorkerIndex = 0
    let leastLoad = workersLoad[0]

    for (let i = 1; i < workersLoad.length; i++) {
        if (workersLoad[i] < leastLoad) {
            leastLoad = workersLoad[i]
            leastLoadedWorkerIndex = i
        }
    }

    return workers[leastLoadedWorkerIndex]
}

export default getWorker
