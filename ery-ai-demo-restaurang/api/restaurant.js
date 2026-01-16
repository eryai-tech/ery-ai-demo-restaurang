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

❌ GÖR ALDRIG:
- Fråga om något kunden REDAN sagt
- Upprepa samma fråga
- Vara fräck eller irriterad
- Hitta på priser eller rätter`;

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

    // Spara AI-svaret i Supabase
    if (currentSessionId && aiResponse) {
      try {
        await supabase.from('chat_messages').insert({
          session_id: currentSessionId,
          role: 'assistant',
          content: aiResponse,
          sender_type: 'ai'
        });
        
        // Uppdatera session
        await supabase
          .from('chat_sessions')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSessionId);
      } catch (err) {
        console.error('Failed to save AI message:', err);
      }
    }

    // Analysera konversationen för komplett reservation
    if (currentSessionId && history && history.length > 0) {
      await analyzeForCompleteReservation(currentSessionId, [...history, { role: 'assistant', content: aiResponse }]);
    }

    return res.status(200).json({
      ...data,
      sessionId: currentSessionId
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Kunde inte kontakta servern' });
  }
}

// Analysera konversation för komplett reservation
async function analyzeForCompleteReservation(sessionId, conversationHistory) {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return;

    // Bygg konversationstext
    const conversationText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Gäst' : 'Sofia'}: ${msg.content}`)
      .join('\n');

    // Analysera med Gemini
    const analysisPrompt = `Analysera denna restaurangkonversation och avgör om ALLA uppgifter för en komplett reservation finns:

${conversationText}

En KOMPLETT reservation måste innehålla ALLA dessa:
1. Datum (specifikt datum eller veckodag)
2. Tid (klockan X)
3. Antal personer
4. Gästens namn
5. Kontaktuppgift (email ELLER telefonnummer)

Svara ENDAST med JSON i detta format (ingen annan text):
{
  "complete": true/false,
  "guest_name": "namn eller null",
  "guest_contact": "email/tel eller null",
  "date": "datum/veckodag eller null",
  "time": "tid eller null",
  "party_size": antal eller null,
  "special_requests": "allergier/önskemål eller null"
}`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Analysis API error:', response.status);
      return;
    }

    const analysisData = await response.json();
    const analysisText = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON från svaret
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in analysis');
      return;
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    console.log('Reservation analysis:', analysis);

    // Om komplett reservation → skapa notification
    if (analysis.complete && analysis.guest_name && analysis.guest_contact) {
      
      // Kolla om notification redan finns för denna session
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('session_id', sessionId)
        .eq('type', 'reservation')
        .single();

      if (existingNotif) {
        console.log('Notification already exists for this session');
        return;
      }

      // Skapa notification
      const summary = `Reservation ${analysis.date} kl ${analysis.time}, ${analysis.party_size} pers${analysis.special_requests ? ', ' + analysis.special_requests : ''}`;
      
      const { data: notification, error: notifError } = await supabase
        .from('notifications')
        .insert({
          customer_id: BELLA_ITALIA_ID,
          session_id: sessionId,
          type: 'reservation',
          priority: 'normal',
          status: 'unread',
          summary: summary,
          guest_name: analysis.guest_name,
          guest_email: analysis.guest_contact.includes('@') ? analysis.guest_contact : null,
          guest_phone: !analysis.guest_contact.includes('@') ? analysis.guest_contact : null,
          reservation_details: {
            date: analysis.date,
            time: analysis.time,
            party_size: analysis.party_size,
            special_requests: analysis.special_requests
          }
        })
        .select()
        .single();

      if (notifError) {
        console.error('Failed to create notification:', notifError);
        return;
      }

      // Uppdatera session
      await supabase
        .from('chat_sessions')
        .update({ needs_human: true })
        .eq('id', sessionId);

      console.log('Notification created:', notification.id);

      // Skicka email
      await sendNotificationEmail(sessionId, {
        type: 'reservation',
        guestName: analysis.guest_name,
        guestContact: analysis.guest_contact,
        summary: summary
      });
    }
  } catch (err) {
    console.error('Reservation analysis error:', err);
  }
}

// Skicka notification email
async function sendNotificationEmail(sessionId, notificationData) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return;
  }

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
        from: 'Sofia - Bella Italia <onboarding@resend.dev>',
        to: 'eric@eryai.tech',
        reply_to: 'sofia@eryai.tech',
        subject: `${typeEmoji[notificationData.type] || '📌'} ${typeText[notificationData.type] || 'Notifikation'} - Bella Italia`,
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
                <h1>${typeEmoji[notificationData.type] || '📌'} Sofia behöver din hjälp!</h1>
              </div>
              <div class="content">
                <div class="detail">
                  <span class="label">Typ:</span> ${typeText[notificationData.type] || notificationData.type}
                </div>
                ${notificationData.guestName ? `
                <div class="detail">
                  <span class="label">Gäst:</span> ${notificationData.guestName}
                </div>` : ''}
                ${notificationData.guestContact ? `
                <div class="detail">
                  <span class="label">Kontakt:</span> ${notificationData.guestContact}
                </div>` : ''}
                <div class="detail">
                  <span class="label">Sammanfattning:</span><br>
                  ${notificationData.summary}
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
}

// Hantera handoff - spara notification och skicka email
