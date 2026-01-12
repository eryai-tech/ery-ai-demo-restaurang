export default async function handler(req, res) {
    const API_KEY = process.env.GEMINI_API_KEY;
    const { prompt } = req.body;

    const systemInstruction = `
    Du är 'Ery', en digital hovmästare för den exklusiva restaurangen Ery Bistro.
    INFO OM RESTAURANGEN:
    - Meny: Vi serverar modern fransk mat. Populärast är vår Entrecôte och vår veganska Ratatouille.
    - Öppettider: 17:00 - 23:00 varje dag.
    - Bokning: Vi tar emot sällskap upp till 8 personer via chatten.
    DINA REGLER:
    1. Svara kort, elegant och på svenska.
    2. Om någon vill boka bord, fråga efter: Dag, tid och antal personer.
    3. Vid allergifrågor, svara att vi kan anpassa alla rätter.
    4. Om du inte vet något, be dem ringa 08-123 45 67.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: systemInstruction }] },
                    { role: "model", parts: [{ text: "Bonjour! Jag är redo att välkomna gäster till Ery Bistro." }] },
                    { role: "user", parts: [{ text: prompt }] }
                ]
            })
        });
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Systemfel' });
    }
}