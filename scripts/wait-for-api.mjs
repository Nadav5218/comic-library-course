const apiUrl = process.env.API_HEALTH_URL || "http://127.0.0.1:3000/api/ping";
const frontendUrl = "http://localhost:8080";
const deadline = Date.now() + 60_000;
let attempt = 0;

console.log(`Waiting for API at ${apiUrl}`);

while (Date.now() < deadline) {
  attempt += 1;
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      console.log(
        `API ready after ${attempt} check${attempt === 1 ? "" : "s"}.`,
      );
      console.log(`Frontend: ${frontendUrl}`);
      process.exit(0);
    }
  } catch {}

  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.error(`API did not become ready within 60 seconds: ${apiUrl}`);
process.exit(1);
