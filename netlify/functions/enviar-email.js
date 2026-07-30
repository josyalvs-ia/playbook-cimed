// Netlify Function — envio de e-mail real via Resend
// Requer a variável de ambiente RESEND_API_KEY configurada no painel da Netlify.
// Opcional: EMAIL_REMETENTE (ex: "Gestão Aprendizes CIMED <aprendizes@seudominio.com.br>")
//           O domínio do remetente precisa estar verificado no Resend.

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Método não permitido" }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify({
        error: "RESEND_API_KEY não configurada. Adicione a chave em Site settings → Environment variables na Netlify.",
      }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const { to, subject, html, text, replyTo, cc } = payload;

    if (!to || !subject || (!html && !text)) {
      return {
        statusCode: 400,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify({ error: "Campos obrigatórios: to, subject e (html ou text)." }),
      };
    }

    const from = process.env.EMAIL_REMETENTE || "Gestão Aprendizes <onboarding@resend.dev>";

    const body = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
    };
    if (html) body.html = html;
    if (text) body.text = text;
    if (replyTo) body.reply_to = replyTo;
    if (cc) body.cc = Array.isArray(cc) ? cc : [cc];

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    return {
      statusCode: resp.status,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
