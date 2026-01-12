export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(200).json({ text: "API-nyckel saknas i Vercel!" });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Svara kort: " + req.body.prompt }] }]
      })
    });

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "Inget svar från AI.";
    
    res.status(200).json({ text: result });
  } catch (error) {
    res.status(200).json({ text: "Serverfel: " + error.message });
  }
}
