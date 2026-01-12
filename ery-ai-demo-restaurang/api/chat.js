export default async function handler(req, res) {
    // Tvinga JSON-svar
    res.setHeader('Content-Type', 'application/json');

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(200).json({ reply: "VARNING: API-nyckel saknas i Vercel Settings!" });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Du är en hovmästare. Svara kort: " + (req.body.prompt || "Hej") }] }]
            })
        });

        const data = await response.json();
        
        // Logga felet om Google nekar anropet
        if (data.error) {
            return res.status(200).json({ reply: "Google API Fel: " + data.error.message });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hovmästaren hittade inget svar.";
        return res.status(200).json({ reply: aiText });

    } catch (err) {
        return res.status(200).json({ reply: "Kopplingsfel: " + err.message });
    }
}
