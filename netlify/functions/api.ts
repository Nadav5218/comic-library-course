import serverless from "serverless-http";
import { createApplication } from "../../server/app-factory";

let cachedHandler: any;

export async function handler(event: any, context: any) {
  if (!cachedHandler) {
    const app = await createApplication({ serveSpa: false });
    await app.init();
    cachedHandler = serverless(app.getHttpAdapter().getInstance());
  }
  return cachedHandler(event, context);
}
