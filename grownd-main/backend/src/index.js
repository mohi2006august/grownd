import cluster from 'node:cluster';
import { config } from './config.js';

// With WEB_CONCURRENCY > 1 this process becomes a supervisor that runs one worker per core
// and replaces any worker that dies. With 1 (the default, right for containers) it just serves.

if (cluster.isPrimary && config.workers > 1) {
  const log = (msg, extra = {}) => console.log(JSON.stringify({ level: 30, time: Date.now(), msg, ...extra }));
  let stopping = false;

  for (let i = 0; i < config.workers; i++) cluster.fork();
  log(`started ${config.workers} workers`, { pid: process.pid });

  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return;
    log('worker exited, starting a replacement', { pid: worker.process.pid, code, signal });
    setTimeout(() => cluster.fork(), 1000); // short pause so a crash loop cannot spin the CPU
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      stopping = true;
      for (const worker of Object.values(cluster.workers)) worker.process.kill(signal);
    });
  }
} else {
  const { start } = await import('./server.js');
  await start();
}
