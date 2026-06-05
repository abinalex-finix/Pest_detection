import os
import sys
import subprocess
import urllib.request
import threading
import time
import re
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configure Gemini AI
api_key = os.getenv("GEMINI_API_KEY")
if api_key and api_key != "your_actual_api_key_here":
    genai.configure(api_key=api_key)

def get_gemini_model():
    return genai.GenerativeModel('gemini-1.5-pro')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    if not api_key or api_key == "your_actual_api_key_here":
        return jsonify({'error': 'Google Gemini API key is missing. Please add it to the .env file.'}), 400

    if 'image' not in request.files:
        return jsonify({'error': 'No image provided.'}), 400

    file = request.files['image']
    mode = request.form.get('mode', 'pest')

    try:
        image_data = file.read()
        image_part = {
            "mime_type": file.mimetype or "image/jpeg",
            "data": image_data
        }
        model = get_gemini_model()

        if mode == 'pest':
            prompt = (
                "You are an expert agricultural botanist and plant pathologist. "
                "Analyze the provided image of a plant/tree. Identify any pests, insects, or diseases visible. "
                "1. Identify the affected plant/tree if possible. "
                "2. Identify the pest or disease. "
                "3. Provide actionable, clear solutions to treat the issue (pesticide recommendations, organic solutions, or agricultural practices). "
                "Format the response in clear Markdown with headings."
            )
        elif mode == 'coconut':
            prompt = (
                "You are an expert agricultural AI. "
                "Analyze the provided image of a coconut tree. Count the number of coconuts visible in the image. "
                "Provide a clear, simple answer stating the estimated total count. If none are visible, say so."
            )
        else:
            return jsonify({'error': 'Invalid mode selected.'}), 400

        response = model.generate_content([prompt, image_part])
        return jsonify({'result': response.text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def start_cloudflare_tunnel():
    exe_name = "cloudflared.exe"
    if not os.path.exists(exe_name):
        print("Downloading free Cloudflare tunnel (no account required)...")
        url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        urllib.request.urlretrieve(url, exe_name)

    print("Starting secure tunnel...")
    process = subprocess.Popen(
        [exe_name, "tunnel", "--url", "http://localhost:5000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    # Read output to find the trycloudflare url
    for line in process.stdout:
        match = re.search(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)', line)
        if match:
            public_url = match.group(1)
            print(f"\n=========================================================")
            print(f"PUBLIC HTTPS URL: {public_url}")
            print(f"Open this link on ANY device to access the Live Camera app!")
            print(f"=========================================================\n")
            break

if __name__ == '__main__':
    # Start Flask app
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
