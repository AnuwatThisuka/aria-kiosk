import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

console.log(`orchestrator listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
