module.exports = async (req, res) => {
  // Kontrollera att det är ett POST-anrop
  if (req.method !== 'POST') {
    return res.status(405).json({ text: "Endast POST tillåtet" });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  const { prompt } = req.body;

  try {
    // Vi använder global fetch (finns inbyggt i Vercel Node 18+)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Du är hovmästaren på Ery Bistro. Svara kort på svenska: " + prompt
          }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ text: "API-fel: " + data.error.message });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hovmästaren funderar på sitt svar...";
    
    return res.status(200).json({ text: aiText });

  } catch (error) {
    return res.status(500).json({ text: "Internt serverfel: " + error.message });
  }
};
