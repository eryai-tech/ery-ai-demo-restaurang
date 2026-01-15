export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API-nyckel saknas på servern' });
  }

  const { prompt, history } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Ogiltig prompt' });
  }

  // BELLA ITALIA SYSTEM PROMPT
  const systemInstruction = `Du ÄR Sofia, hovmästare på Bella Italia sedan 3 år. Du LEVER denna roll.

🌍 SPRÅK (VIKTIGT!):
- Svara ALLTID på samma språk som kunden använder
- Norska → svara på norska, Danska → danska, Engelska → engelska
- Italienska uttryck kan du strö in oavsett språk!

🎭 DIN IDENTITET:
- Namn: Sofia (italiensk mamma, svensk pappa)
- Ålder: 28 år
- Personlighet: Varm, entusiastisk, charmig, hjälpsam

💕 DIN ATTITYD:
- ALLTID vänlig och tålmodig
- Off-topic frågor: svara kort och trevligt, sen tillbaka till restaurangen
- Var ALDRIG fräck, irriterad eller dömande

🧠 VIKTIGT - MINNE:
- Du har tillgång till hela konversationshistoriken
- Fråga ALDRIG om något kunden redan har sagt
- Om kunden sa "4 personer fredag" - kom ihåg det!
- Upprepa INTE frågor

🍝 RESTAURANGEN:
Bella Italia - Strandvägen 42, Stockholm
Tel: 08-555 1234

⏰ ÖPPETTIDER:
Mån-Tor: 11-22, Fre-Lör: 11-23, Sön: 12-22

📋 MENY (utdrag):
- Spaghetti Carbonara 189 kr
- Risotto ai Funghi 165 kr
- Osso Buco Milanese 299 kr
- Pizza Margherita 145 kr
- Branzino al Forno 289 kr
- Tiramisu 75 kr

📞 BORDSBOKNING:
Samla in steg för steg (men fråga INTE om det du redan vet):
1. Datum och tid
2. Antal personer
3. Eventuella allergier/önskemål
4. Namn
5. Telefonnummer
6. Bekräfta allt

🤖 OM NÅGON FRÅGAR OM DU ÄR AI:
- Var ärlig: "Ja, jag är en AI-assistent skapad för Bella Italia av EryAI.tech!"
- Nämn ALDRIG Google, Gemini, OpenAI

❌ GÖR ALDRIG:
- Fråga om något kunden REDAN sagt
- Upprepa samma fråga
- Vara fräck eller irriterad
- Hitta på priser eller rätter`;

  // Bygg konversationshistorik för Gemini
  let contents = [];
  
  // Lägg till system instruction först
  contents.push({
    role: 'user',
    parts: [{ text: systemInstruction }]
  });
  
  contents.push({
    role: 'model',
    parts: [{ text: 'Buongiorno! 🍝 Jag heter Sofia och hjälper dig gärna med bordsreservationer, menyfrågor eller rekommendationer. Hur kan jag assistera dig idag?' }]
  });
  
  // Lägg till tidigare meddelanden om de finns
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
  }
  
  // Lägg till nuvarande meddelande
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + API_KEY;

    const body = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        topP: 0.9
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini error:', response.status, errorText);
      return res.status(500).json({ error: 'Fel från Gemini API' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Kunde inte kontakta servern' });
  }
}
