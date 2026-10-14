// One poll at a time, bounded command concurrency, independent of review sync.
// The caller keeps its account lock around run() to protect Chrome sessions.
export default function startStoreCommandLane({ claim, run, onError, intervalMs = 5000, capacity = 4 }) {
  const active = new Set();
  let stopped = false;
  let timer;
  let polling = Promise.resolve();
  const report = async (error) => { await Promise.resolve().then(() => onError(error)).catch(() => null); };
  const tick = async () => {
    try {
      const slots = capacity - active.size;
      if (slots > 0) {
        const sources = await claim(slots);
        for (const source of sources) {
          const task = Promise.resolve().then(() => run(source)).catch(report);
          active.add(task);
          task.finally(() => active.delete(task));
        }
      }
    } catch (error) {
      await report(error);
    } finally {
      if (!stopped) timer = setTimeout(() => { polling = tick(); }, intervalMs);
    }
  };
  polling = tick();
  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await polling;
      await Promise.allSettled([...active]);
    }
  };
}
