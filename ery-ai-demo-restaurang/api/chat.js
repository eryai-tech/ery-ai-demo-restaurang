export default async function handler(req, res) {
  const { prompt } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(200).json({ text: "Systemet hittar ingen API-nyckel i Vercel. Kontrollera Environment Variables." });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Du är hovmästaren på Ery Bistro. Svara kort och elegant på: " + prompt }] }]
      })
    });

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hovmästaren funderar... (Inget svar från AI)";
    
    res.status(200).json({ text: aiText });
  } catch (error) {
    res.status(500).json({ text: "Ett fel uppstod i kontakten med hovmästaren." });
  }
}
