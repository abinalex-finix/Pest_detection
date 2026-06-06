document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const apiKeyModal = document.getElementById('api-key-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');

    const openCameraBtn = document.getElementById('open-camera-btn');
    const cameraContainer = document.getElementById('camera-container');
    const video = document.getElementById('camera-video');
    const captureBtn = document.getElementById('capture-btn');
    const canvas = document.getElementById('canvas');
    
    const imageUpload = document.getElementById('image-upload');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const retakeBtn = document.getElementById('retake-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('result-container');
    const resultText = document.getElementById('result-text');
    const gallery = document.getElementById('reference-gallery');

    let selectedFile = null;
    let stream = null;
    let base64Image = null;

    // --- API Key Management ---
    function checkApiKey() {
        const key = localStorage.getItem('GEMINI_API_KEY');
        if (!key) {
            apiKeyModal.classList.remove('hidden');
        }
    }
    checkApiKey();

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('GEMINI_API_KEY', key);
            apiKeyModal.classList.add('hidden');
        } else {
            alert("Please enter a valid API key.");
        }
    });

    // --- WebRTC Camera Logic ---
    openCameraBtn.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            cameraContainer.classList.remove('hidden');
            previewContainer.classList.add('hidden');
            resultContainer.classList.add('hidden');
        } catch (err) {
            alert('Could not access camera. Please ensure you are using HTTPS and have granted permissions.');
            console.error(err);
        }
    });

    captureBtn.addEventListener('click', () => {
        if (!stream) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            selectedFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
            const imageUrl = URL.createObjectURL(blob);
            showPreview(imageUrl);
            convertFileToBase64(selectedFile);
            stopCamera();
        }, 'image/jpeg', 0.9);
    });

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraContainer.classList.add('hidden');
    }

    // --- File Upload Logic ---
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            const imageUrl = URL.createObjectURL(file);
            showPreview(imageUrl);
            convertFileToBase64(file);
            stopCamera();
        }
    });

    function convertFileToBase64(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data:image/jpeg;base64, prefix
            base64Image = reader.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }

    // --- Common UI Flow ---
    function showPreview(url) {
        imagePreview.src = url;
        previewContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
    }

    retakeBtn.addEventListener('click', () => {
        selectedFile = null;
        base64Image = null;
        previewContainer.classList.add('hidden');
        resultContainer.classList.add('hidden');
        openCameraBtn.click();
    });

    // --- Wikipedia Image Fetcher ---
    async function fetchWikipediaImage(query) {
        if (!query || query.toLowerCase() === 'unknown' || query.toLowerCase() === 'none') return null;
        try {
            const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(query)}&origin=*`;
            const response = await fetch(url);
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pages[pageId] && pages[pageId].original) {
                return pages[pageId].original.source;
            }
        } catch (e) {
            console.error("Wiki image error:", e);
        }
        return null;
    }

    // --- Analyze using Gemini REST API ---
    analyzeBtn.addEventListener('click', async () => {
        if (!base64Image) {
            alert("Please capture or upload an image first.");
            return;
        }

        const apiKey = localStorage.getItem('GEMINI_API_KEY');
        if (!apiKey) {
            apiKeyModal.classList.remove('hidden');
            return;
        }

        const mode = document.querySelector('input[name="mode"]:checked').value;
        let promptText = "";

        if (mode === 'pest') {
            promptText = "You are an expert agricultural botanist and plant pathologist. " +
                         "Analyze the provided image of a plant/tree. Identify any pests, insects, or diseases visible. " +
                         "You MUST return the output strictly as a valid JSON object with the following keys: " +
                         "\"plant_name\" (Name of the plant/tree), " +
                         "\"pest_name\" (Name of the pest/disease), " +
                         "\"solution_keywords\" (1-2 words summarizing the best treatment, e.g. 'Neem Oil' or 'Pruning'), " +
                         "\"detailed_analysis\" (Detailed markdown string with solution headings). " +
                         "If you cannot identify them, use \"Unknown\" for the names.";
        } else {
            promptText = "You are an expert agricultural AI. " +
                         "Analyze the provided image of a coconut tree. Count the number of coconuts visible in the image. " +
                         "You MUST return the output strictly as a valid JSON object with the following keys: " +
                         "\"plant_name\" (value should be \"Coconut Tree\"), " +
                         "\"pest_name\" (value should be \"None\"), " +
                         "\"solution_keywords\" (value should be \"None\"), " +
                         "\"detailed_analysis\" (Detailed text stating the total count).";
        }

        previewContainer.classList.add('hidden');
        loading.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        gallery.innerHTML = '';
        gallery.classList.add('hidden');

        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
            const requestBody = {
                contents: [{
                    parts: [
                        { text: promptText },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.2
                }
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            loading.classList.add('hidden');
            previewContainer.classList.remove('hidden'); 
            resultContainer.classList.remove('hidden');

            if (data.error) {
                resultText.innerHTML = `<p style="color: red;">API Error: ${data.error.message}</p>`;
                if (data.error.message.includes("API key not valid")) {
                    localStorage.removeItem('GEMINI_API_KEY');
                    setTimeout(() => checkApiKey(), 1000);
                }
                return;
            }

            // Extract the text response
            let rawJson = data.candidates[0].content.parts[0].text.trim();
            if (rawJson.startsWith("```json")) rawJson = rawJson.substring(7);
            else if (rawJson.startsWith("```")) rawJson = rawJson.substring(3);
            if (rawJson.endsWith("```")) rawJson = rawJson.substring(0, rawJson.length - 3);

            let parsedResult;
            try {
                parsedResult = JSON.parse(rawJson);
            } catch (e) {
                console.error("JSON parse failed", rawJson);
                resultText.innerHTML = marked.parse(rawJson);
                return;
            }

            resultText.innerHTML = marked.parse(parsedResult.detailed_analysis || "Analysis completed.");

            // Fetch Reference Images
            if (mode === 'pest') {
                const plantImg = await fetchWikipediaImage(parsedResult.plant_name);
                const pestImg = await fetchWikipediaImage(parsedResult.pest_name);
                const solutionImg = await fetchWikipediaImage(parsedResult.solution_keywords);

                if (plantImg || pestImg || solutionImg) {
                    gallery.classList.remove('hidden');
                    if (plantImg) {
                        gallery.innerHTML += `<div class="ref-card"><img src="${plantImg}" alt="Plant">
                                              <div class="ref-card-info"><strong>Affected Plant</strong>${parsedResult.plant_name}</div></div>`;
                    }
                    if (pestImg) {
                        gallery.innerHTML += `<div class="ref-card"><img src="${pestImg}" alt="Pest">
                                              <div class="ref-card-info"><strong>Identified Issue</strong>${parsedResult.pest_name}</div></div>`;
                    }
                    if (solutionImg) {
                        gallery.innerHTML += `<div class="ref-card"><img src="${solutionImg}" alt="Solution">
                                              <div class="ref-card-info"><strong>Treatment</strong>${parsedResult.solution_keywords}</div></div>`;
                    }
                }
            }

        } catch (error) {
            loading.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            resultContainer.classList.remove('hidden');
            resultText.innerHTML = `<p style="color: red;">Network Error: ${error.message}</p>`;
            console.error(error);
        }
    });
});
