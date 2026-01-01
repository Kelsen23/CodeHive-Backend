import client from "./src/config/openai.js";

async function singleCall() {
  console.log("Making ONE manual OpenAI call...");
  console.log("Time:", new Date().toISOString());

  try {
    const response = await client.moderations.create({
      model: "omni-moderation-latest",
      input: "This is a single test call",
    });

    console.log("✅ SUCCESS!");
    console.log("Result:", response.results[0]);
  } catch (error: any) {
    console.error("❌ FAILED");
    console.error("Status:", error.status);
    console.error("Message:", error.message);

    if (error.status === 429) {
      console.error("Rate Limit exceeded or Payment method not present on OpenAI account.🚨");
    }
  }
}

singleCall();
