import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Bella Italia customer ID
const BELLA_ITALIA_ID = '3c6d67d9-22bb-4a3e-94ca-ca552eddb08e';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API-nyckel saknas på servern' });
  }

  const { prompt, history, sessionId } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Ogiltig prompt' });
  }

  let currentSessionId = sessionId;

  // Skapa ny session om ingen finns
  if (!currentSessionId) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          customer_id: BELLA_ITALIA_ID,
          status: 'active',
          metadata: { source: 'web-widget' }
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase session error:', error);
      } else {
        currentSessionId = data.id;
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }

  // Spara användarens meddelande
  if (currentSessionId) {
    try {
      await supabase.from('chat_messages').insert({
        session_id: currentSessionId,
        role: 'user',
        content: prompt,
        sender_type: 'user'
      });
    } catch (err) {
      console.error('Failed to save user message:', err);
    }
  }

  // BELLA ITALIA SYSTEM PROMPT MED HANDOFF-DETECTION
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

📞 BORDSBOKNING - SAMLA IN STEG FÖR STEG:
1. Datum och tid
2. Antal personer
3. Eventuella allergier/önskemål
4. Namn
5. Telefonnummer eller email (för bekräftelse)
6. Bekräfta allt och meddela att restaurangen återkommer

🤖 OM NÅGON FRÅGAR OM DU ÄR AI:
- Var ärlig: "Ja, jag är en AI-assistent skapad för Bella Italia av EryAI.tech!"
- Nämn ALDRIG Google, Gemini, OpenAI

🚨 HANDOFF-DETECTION (EXTREMT VIKTIGT - FÖLJ EXAKT!):
När något av detta händer, lägg till en speciell rad I SLUTET av ditt svar. Formatet MÅSTE vara EXAKT som visas nedan - inga mellanslag eller extra tecken!

1. KOMPLETT RESERVATION (alla uppgifter samlade: datum, tid, antal, namn, kontakt):
   Avsluta med EXAKT detta format på EN rad:
   |||HANDOFF:reservation|||GUESTNAME:namn|||GUESTCONTACT:email/tel|||SUMMARY:Reservation [datum] kl [tid], [antal] pers, [ev allergier]|||

2. ALLERGI/SPECIALKOST som behöver bekräftas av kök:
   |||HANDOFF:special_request|||SUMMARY:Allergi/specialkost: [detaljer]|||

3. KLAGOMÅL eller missnöje:
   |||HANDOFF:complaint|||SUMMARY:[kort beskrivning av problemet]|||

4. GÄSTEN BER UTTRYCKLIGEN att prata med personal:
   |||HANDOFF:handoff|||SUMMARY:Gästen vill prata med personal om [anledning]|||

5. FRÅGA DU INTE KAN SVARA PÅ:
   |||HANDOFF:question|||SUMMARY:[frågan som behöver besvaras]|||

KORREKT EXEMPEL på komplett reservation:
"Perfetto! Jag har noterat din reservation:
📅 Fredag 24 januari kl 19:00
👥 4 personer
🥜 Glutenfritt för en gäst
📱 Anna, 070-123 4567

Jag skickar detta till restaurangen så återkommer de med bekräftelse inom kort. Grazie mille! 🍝
|||HANDOFF:reservation|||GUESTNAME:Anna|||GUESTCONTACT:070-123 4567|||SUMMARY:Reservation fre 24/1 kl 19:00, 4 pers, 1 glutenfri|||"

FELAKTIGT (gör INTE så här):
"Grazie mille! 🍝 GUESTNAME:Anna SUMMARY:..." ❌
"|||HANDOFF:reservation GUESTNAME:Anna|||" ❌

❌ GÖR ALDRIG:
- Fråga om något kunden REDAN sagt
- Upprepa samma fråga
- Vara fräck eller irriterad
- Hitta på priser eller rätter
- Glömma att lägga till HANDOFF-taggen när det behövs`;

  // Bygg konversationshistorik för Gemini
  let contents = [];
  
  contents.push({
    role: 'user',
    parts: [{ text: systemInstruction }]
  });
  
  contents.push({
    role: 'model',
    parts: [{ text: 'Buongiorno! 🍝 Jag heter Sofia och hjälper dig gärna med bordsreservationer, menyfrågor eller rekommendationer. Hur kan jag assistera dig idag?' }]
  });
  
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
  }
  
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
        maxOutputTokens: 500,
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
    let aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // HANDOFF DETECTION - Parse och hantera
    let handoffData = null;
    let cleanResponse = aiResponse;
    
    if (aiResponse.includes('|||HANDOFF:')) {
      // Extrahera handoff-data
      const handoffMatch = aiResponse.match(/\|\|\|HANDOFF:(\w+)\|\|\|/);
      const guestNameMatch = aiResponse.match(/\|\|\|GUESTNAME:([^|]+)\|\|\|/);
      const guestContactMatch = aiResponse.match(/\|\|\|GUESTCONTACT:([^|]+)\|\|\|/);
      const summaryMatch = aiResponse.match(/\|\|\|SUMMARY:([^|]+)\|\|\|/);
      
      if (handoffMatch) {
        handoffData = {
          type: handoffMatch[1],
          guestName: guestNameMatch ? guestNameMatch[1].trim() : null,
          guestContact: guestContactMatch ? guestContactMatch[1].trim() : null,
          summary: summaryMatch ? summaryMatch[1].trim() : 'Behöver uppföljning'
        };
        
        // Ta bort handoff-taggarna från svaret till gästen
        cleanResponse = aiResponse.replace(/\|\|\|[^|]+\|\|\|/g, '').trim();
      }
    }

    // Spara AI-svaret i Supabase (utan handoff-taggar)
    if (currentSessionId && cleanResponse) {
      try {
        await supabase.from('chat_messages').insert({
          session_id: currentSessionId,
          role: 'assistant',
          content: cleanResponse,
          sender_type: 'ai'
        });
        
        // Uppdatera session
        await supabase
          .from('chat_sessions')
          .update({ 
            updated_at: new Date().toISOString(),
            needs_human: handoffData ? true : false
          })
          .eq('id', currentSessionId);
      } catch (err) {
        console.error('Failed to save AI message:', err);
      }
    }

    // Om handoff behövs - skapa notification och skicka email
    if (handoffData && currentSessionId) {
      await handleHandoff(currentSessionId, handoffData);
    }

    // Skicka tillbaka RENT svar till gästen (utan handoff-taggar)
    const cleanData = {
      ...data,
      sessionId: currentSessionId
    };
    
    // Ersätt AI-svaret med det rena svaret
    if (cleanData.candidates?.[0]?.content?.parts?.[0]) {
      cleanData.candidates[0].content.parts[0].text = cleanResponse;
    }

    return res.status(200).json(cleanData);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Kunde inte kontakta servern' });
  }
}

// Hantera handoff - spara notification och skicka email
async function handleHandoff(sessionId, handoffData) {
  try {
    // 1. Spara notification i Supabase
    const priority = handoffData.type === 'complaint' ? 'high' : 
                     handoffData.type === 'reservation' ? 'normal' : 'normal';
    
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        customer_id: BELLA_ITALIA_ID,
        session_id: sessionId,
        type: handoffData.type,
        priority: priority,
        status: 'unread',
        summary: handoffData.summary,
        guest_name: handoffData.guestName,
        guest_email: handoffData.guestContact?.includes('@') ? handoffData.guestContact : null,
        guest_phone: handoffData.guestContact && !handoffData.guestContact.includes('@') ? handoffData.guestContact : null
      })
      .select()
      .single();

    if (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    // 2. Skicka email via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const typeEmoji = {
        reservation: '📅',
        complaint: '⚠️',
        question: '❓',
        special_request: '🥗',
        handoff: '👋'
      };
      
      const typeText = {
        reservation: 'Ny reservation',
        complaint: 'Klagomål - behöver uppmärksamhet',
        question: 'Fråga som behöver svar',
        special_request: 'Specialönskemål',
        handoff: 'Gäst vill prata med personal'
      };

      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Sofia <sofia@eryai.tech>',
            to: 'eric@eryai.tech', // TODO: Hämta från customer.settings.notification_email
            subject: `${typeEmoji[handoffData.type] || '📌'} ${typeText[handoffData.type] || 'Notifikation'} - Bella Italia`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1c1c1c; }
                  .container { max-width: 500px; margin: 0 auto; padding: 20px; }
                  .header { background: #2d3e2f; color: #d4a574; padding: 20px; border-radius: 12px 12px 0 0; }
                  .header h1 { margin: 0; font-size: 24px; }
                  .content { background: #faf8f5; padding: 24px; border: 1px solid #e0d5c7; }
                  .detail { margin: 12px 0; }
                  .label { font-weight: 600; color: #2d3e2f; }
                  .cta { display: inline-block; background: #d4a574; color: #1c1c1c; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
                  .footer { background: #1c1c1c; color: #888; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 12px 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>${typeEmoji[handoffData.type] || '📌'} Sofia behöver din hjälp!</h1>
                  </div>
                  <div class="content">
                    <div class="detail">
                      <span class="label">Typ:</span> ${typeText[handoffData.type] || handoffData.type}
                    </div>
                    ${handoffData.guestName ? `
                    <div class="detail">
                      <span class="label">Gäst:</span> ${handoffData.guestName}
                    </div>` : ''}
                    ${handoffData.guestContact ? `
                    <div class="detail">
                      <span class="label">Kontakt:</span> ${handoffData.guestContact}
                    </div>` : ''}
                    <div class="detail">
                      <span class="label">Sammanfattning:</span><br>
                      ${handoffData.summary}
                    </div>
                    <a href="https://dashboard.eryai.tech/chat/${sessionId}" class="cta">
                      Öppna konversationen →
                    </a>
                  </div>
                  <div class="footer">
                    Skickat av Sofia AI · Bella Italia · Powered by EryAI.tech
                  </div>
                </div>
              </body>
              </html>
            `
          })
        });
        
        const emailResult = await emailResponse.json();
        
        if (emailResponse.ok) {
          console.log('Email sent successfully:', emailResult.id);
        } else {
          console.error('Resend API error:', emailResponse.status, emailResult);
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    } else {
      console.log('RESEND_API_KEY not set, skipping email');
    }
  } catch (err) {
    console.error('Handoff error:', err);
  }
}
