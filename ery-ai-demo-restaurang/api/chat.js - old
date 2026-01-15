module.exports = async (req, res) => {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ text: "Endast POST tillåtet" });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Du är en hovmästare på Ery Bistro. Svara kort och elegant på svenska: " + req.body.prompt }]
        }]
      })
    });

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hovmästaren är tillfälligt upptagen.";
    
    res.status(200).json({ text: aiText });
  } catch (error) {
    res.status(500).json({ text: "Serverfel: " + error.message });
  }
};
