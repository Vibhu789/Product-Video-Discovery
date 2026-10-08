import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 2 }); // two searches at once; the rest wait

export const enqueueSearch = (task) => queue.add(task);
export const queueLoad = () => queue.size + queue.pending;