export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(200).json({ error: "API-nyckel saknas i Vercel Settings!" });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Du är en artig hovmästare. Svara kort på: " + req.body.prompt }] }]
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Jag kunde inte formulera ett svar just nu.";
    res.status(200).json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: "Internt serverfel." });
  }
}
