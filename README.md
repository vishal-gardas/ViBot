# ViBot — Voice-Enabled Chatbot

## 1. Dataset
The dataset (`data/intents.json`) is structured as a collection of 15 conversational intents (e.g., greetings, goodbyes, weather, jokes, programming help). Each intent contains an array of sample user inputs (`patterns`) and corresponding bot replies (`responses`). The patterns are tokenized (converted to lowercase, stripped of punctuation, and filtered of stop-words) to create a normalized vocabulary mapping.

## 2. Model Architecture
The chatbot utilizes a custom-built feed-forward Deep Learning Neural Network (Multi-Layer Perceptron) with the following architecture:
* **Input Layer:** A Bag-of-Words (BoW) vector representing the presence or absence of vocabulary words in the user's input.
* **Hidden Layer:** A dense layer with 48 neurons utilizing the Rectified Linear Unit (ReLU) activation function to capture non-linear relationships between words.
* **Output Layer:** A dense layer with 15 neurons (matching the number of intent classes) utilizing the Softmax activation function to output a probability distribution across all possible intents.

## 3. Methodology
* **Training (`train-model.js`):** The model is trained entirely from scratch using backpropagation and stochastic gradient descent. It runs for 1900 epochs with a decaying learning rate to minimize loss. The trained weights and biases are exported as a JSON file.
* **Speech Integration (`app.js`):** The client-side application requests microphone access and uses the browser's native `SpeechRecognition` API. When the user speaks, it transcribes the audio in real-time. 
* **Inference:** The transcribed text is converted into a Bag-of-Words vector and passed through the pre-trained neural network weights. If the highest probability output exceeds a 65% confidence threshold, the bot returns a local response. Otherwise, it intelligently falls back to a general LLM via a serverless function (`netlify/functions/chat.js`).

## 4. Results
The neural intent classifier successfully converges, achieving high accuracy on the training dataset. In production, the system successfully listens to user audio, accurately classifies common intents locally (with zero server latency), and seamlessly renders both the transcribed voice input and the bot's response in the chat interface.
