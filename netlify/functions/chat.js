const SYSTEM_PROMPT = 'You are ViBot, a concise, helpful voice-enabled AI assistant. Answer general questions clearly. Use short paragraphs or bullets when helpful. Do not explain your underlying architecture. State when a question needs professional advice rather than inventing facts.';

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is missing.' }) };

    try {
        const { messages } = JSON.parse(event.body || '{}');
        if (!Array.isArray(messages) || !messages.length) return { statusCode: 400, body: JSON.stringify({ error: 'A message is required.' }) };
        
        // Convert to Gemini format for generateContent API
        const recentMessages = messages.slice(-8);

        const contents = [];
        for (const item of recentMessages) {
            const role = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
            const text = String(item.content || '').slice(0, 2000);
            
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += '\n\n' + text;
            } else {
                contents.push({ role, parts: [{ text }] });
            }
        }
        
        // Gemini API generally expects the first message to be from 'user'
        if (contents.length > 0 && contents[0].role === 'model') {
            contents.shift();
        }
        
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: contents,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7
                }
            })
        });

        const data = await response.json();
        if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || 'The AI service could not answer right now.' }) };
        
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const reply = replyText.trim();
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: reply || 'I could not generate a response.' }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Unable to contact the AI service. Please try again.' }) };
    }
};
