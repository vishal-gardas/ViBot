const $ = s => document.querySelector(s);
const messages = $('#messages'), input = $('#text-input'), mic = $('#mic'), listening = $('#listening'), appStatus = $('#app-status');
let recognition, isListening = false, isProcessing = false, microphoneReady = false;
const history = [];

let localModel = null;
fetch('/model/vibot-model.json').then(r => r.json()).then(data => localModel = data).catch(() => {});

const stopWords = new Set(['a','an','the','is','it','i','me','my','to','do','you','are','can','how','what','will','be','this','that','with','about','of','for','on','and','we']);
const tokenize = text => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !stopWords.has(w));

function predictLocal(text) {
    if (!localModel) return null;
    const { vocabulary, labels, responses, weights } = localModel;
    const { w1, b1, w2, b2 } = weights;
    const tokens = tokenize(text);
    const knownCount = tokens.filter(w => vocabulary.includes(w)).length;
    const unknownCount = tokens.length - knownCount;
    if (unknownCount > knownCount) return null;

    const set = new Set(tokens);
    const x = vocabulary.map(word => set.has(word) ? 1 : 0);
    
    const hRaw = w1.map((row, j) => b1[j] + row.reduce((s, w, i) => s + w * x[i], 0));
    const h = hRaw.map(n => Math.max(0, n));
    const logits = w2.map((row, j) => b2[j] + row.reduce((s, w, i) => s + w * h[i], 0));
    const max = Math.max(...logits);
    const exp = logits.map(n => Math.exp(n - max));
    const probs = exp.map(n => n / exp.reduce((a,b) => a+b, 0));
    
    const maxProb = Math.max(...probs);
    const labelIndex = probs.indexOf(maxProb);
    const tag = labels[labelIndex];
    
    if (maxProb > 0.65 && tag !== 'fallback') {
        const intentResponses = responses[labelIndex];
        const replyText = intentResponses[Math.floor(Math.random() * intentResponses.length)];
        return replyText.replace('{time}', new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    }
    return null;
}

function syncStatus() {
    if (!appStatus) return;
    let text = 'READY TO TALK';
    if (isProcessing) text = 'PROCESSING';
    else if (isListening) text = 'LISTENING';
    appStatus.querySelector('span').textContent = text;
}

function addMessage(text, sender, detail = '') { 
    const node = $('#message-template').content.firstElementChild.cloneNode(true); 
    node.classList.add(sender); 
    node.querySelector('.avatar').textContent = sender === 'bot' ? 'V' : 'Y'; 
    node.querySelector('.role').textContent = sender === 'bot' ? 'VIBOT' : 'YOU'; 
    node.querySelector('p').textContent = text; 
    node.querySelector('small').textContent = detail; 
    messages.append(node); 
    messages.scrollTop = messages.scrollHeight; 
    return node; 
}

function showListening(text, active = true) { 
    listening.hidden = false; 
    listening.innerHTML = `<span></span> ${text}`; 
    listening.classList.toggle('warning', !active); 
}

async function getGeneralAnswer() { 
    const response = await fetch('/.netlify/functions/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ messages: history }) 
    }); 
    const data = await response.json(); 
    if (!response.ok) throw new Error(data.error || 'ViBot could not answer right now.'); 
    return data.reply; 
}

async function reply(text) { 
    if (isProcessing) return;
    addMessage(text, 'user', 'Recognized input'); 
    history.push({ role: 'user', content: text }); 
    
    const localReply = predictLocal(text);
    if (localReply) {
        addMessage(localReply, 'bot', 'LOCAL AI');
        history.push({ role: 'assistant', content: localReply });
        messages.scrollTop = messages.scrollHeight;
        return;
    }

    const pending = addMessage('Thinking…', 'bot', 'GENERAL AI'); 
    isProcessing = true;
    syncStatus();
    try { 
        const answer = await getGeneralAnswer(); 
        pending.querySelector('p').textContent = answer; 
        pending.querySelector('small').textContent = 'GENERAL AI'; 
        history.push({ role: 'assistant', content: answer }); 
    } catch (error) { 
        pending.querySelector('p').textContent = error.message; 
        pending.querySelector('small').textContent = 'SETUP REQUIRED'; 
    } 
    isProcessing = false;
    syncStatus();
    messages.scrollTop = messages.scrollHeight; 
}

$('#chat-form').addEventListener('submit', event => { 
    event.preventDefault(); 
    const text = input.value.trim(); 
    if (!text) return; 
    input.value = ''; 
    reply(text); 
});

async function confirmMicrophone() { 
    if (microphoneReady || !navigator.mediaDevices?.getUserMedia) return true; 
    try { 
        showListening('Requesting microphone access…'); 
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); 
        stream.getTracks().forEach(track => track.stop()); 
        microphoneReady = true; 
        return true; 
    } catch { 
        showListening('Microphone permission is blocked. Enable it in your browser site settings, then try again.', false); 
        window.setTimeout(() => listening.hidden = true, 5200); 
        return false; 
    } 
}

function setupRecognition() { 
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
    if (!Recognition) { 
        mic.disabled = true; 
        mic.title = 'Speech recognition is supported in Chrome and Edge.'; 
        return; 
    } 
    recognition = new Recognition(); 
    recognition.lang = navigator.language || 'en-US'; 
    recognition.interimResults = true; 
    recognition.continuous = false; 
    recognition.maxAlternatives = 1; 
    
    recognition.onstart = () => { 
        isListening = true; 
        mic.classList.add('active'); 
        showListening('Listening… speak now'); 
        syncStatus();
    }; 
    
    recognition.onend = () => { 
        isListening = false; 
        mic.classList.remove('active'); 
        if (!listening.classList.contains('warning')) listening.hidden = true; 
        syncStatus();
    };
    
    recognition.onerror = event => { 
        if (event.error === 'aborted') return; 
        isListening = false; 
        mic.classList.remove('active'); 
        const errors = {'no-speech':'No voice was detected. Check that the correct microphone is selected, then try again.','not-allowed':'Microphone access is blocked. Enable it in your browser site settings, then try again.','service-not-allowed':'Speech recognition is unavailable in this browser. Try Chrome or Edge.','network':'Speech recognition could not connect. Check your internet connection and try again.'}; 
        showListening(errors[event.error] || `Voice input error: ${event.error}. Please try again.`, false); 
        window.setTimeout(() => { listening.hidden = true; listening.classList.remove('warning'); }, 5200); 
        syncStatus();
    }; 
    
    recognition.onresult = event => { 
        const text = Array.from(event.results).map(result => result[0].transcript).join(''); 
        input.value = text; 
    }; 
    
    mic.addEventListener('click', async () => { 
        if (isListening) return recognition.stop(); 
        if (await confirmMicrophone()) try { recognition.start(); } catch {} 
    }); 
}

setupRecognition();
