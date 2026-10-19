// Fan-out of "this job changed" signals from workers to open SSE streams (§7.4).
// Redis pub/sub is a disposable transport: streams also re-read the job on a
// timer, so a lost message only delays an update.

import type { Redis } from 'ioredis';
import { jobEventsChannel } from '@tracck/shared';

export interface JobEvents {
  /** Returns a function that stops listening. */
  subscribe(jobId: string, listener: () => void): () => void;
}

export function createRedisJobEvents(subscriber: Redis): JobEvents {
  const listeners = new Map<string, Set<() => void>>();

  subscriber.on('message', (channel: string) => {
    listeners.get(channel)?.forEach((listener) => listener());
  });

  return {
    subscribe(jobId, listener) {
      const channel = jobEventsChannel(jobId);
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
        void subscriber.subscribe(channel);
      }
      set.add(listener);

      return () => {
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(channel);
          void subscriber.unsubscribe(channel);
        }
      };
    },
  };
}
