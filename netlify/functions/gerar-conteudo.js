exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "Metodo nao permitido" };
  try {
    const payload = JSON.parse(event.body || "{}");
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: payload.model || "claude-sonnet-4-6",
        max_tokens: payload.max_tokens || 1000,
        system: payload.system,
        messages: payload.messages,
      }),
    });
    const data = await resp.json();
    return {
      statusCode: resp.status,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(err) }) };
  }
};
