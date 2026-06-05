document.addEventListener('DOMContentLoaded', () => {
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

    let selectedFile = null;
    let stream = null;

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
            const reader = new FileReader();
            reader.onload = (e) => {
                showPreview(e.target.result);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Common UI Flow ---
    function showPreview(url) {
        imagePreview.src = url;
        previewContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
    }

    retakeBtn.addEventListener('click', () => {
        selectedFile = null;
        previewContainer.classList.add('hidden');
        resultContainer.classList.add('hidden');
        // If they want to retake, open camera again
        openCameraBtn.click();
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        const mode = document.querySelector('input[name="mode"]:checked').value;
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('mode', mode);

        previewContainer.classList.add('hidden');
        loading.classList.remove('hidden');
        resultContainer.classList.add('hidden');

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            loading.classList.add('hidden');
            previewContainer.classList.remove('hidden'); // Show image again
            resultContainer.classList.remove('hidden');

            if (response.ok) {
                resultText.innerHTML = marked.parse(data.result);
            } else {
                resultText.innerHTML = `<p style="color: red;">Error: ${data.error}</p>`;
            }

        } catch (error) {
            loading.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            resultContainer.classList.remove('hidden');
            resultText.innerHTML = `<p style="color: red;">Network Error: ${error.message}</p>`;
        }
    });
});
