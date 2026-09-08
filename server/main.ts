import { createApplication } from "./app-factory";

async function bootstrap() {
  const app = await createApplication({ serveSpa: true });
  const port = Number(process.env.PORT || 3000);
  const host =
    process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  await app.listen(port, host);
  console.log(`NestJS server running on ${host}:${port}`);
}

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
void bootstrap();
