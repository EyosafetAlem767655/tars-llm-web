// test-julep.js
require("dotenv").config({ path: ".env.local" });
const { Julep } = require("@julep/sdk");

async function testConnection() {
  try {
    const client = new Julep({
      apiKey: process.env.JULEP_API_KEY,
    });

    const agent = await client.agents.create({
      name:  "Test Agent",
      about: "Testing Julep SDK connectivity",
      model: "gpt-4o-mini", 
    });

    console.log("✅ Successfully connected to Julep! Agent ID:", agent.id);
  } catch (err) {
    console.error("❌ Connection test failed:", err);
  }
}

testConnection();
