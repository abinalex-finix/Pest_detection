import os
import sys
import subprocess
import urllib.request
import threading
import time
import re
import json
import urllib.request
import urllib.parse
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

def fetch_wikipedia_image(query):
    if not query or query.lower() in ['unknown', 'none']: return None
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles={urllib.parse.quote(query)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'AgriLens/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_info in pages.items():
                if "original" in page_info:
                    return page_info["original"]["source"]
    except Exception as e:
        print(f"Wiki image error for {query}: {e}")
    return None

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
                "You MUST return the output strictly as a valid JSON object with the following keys: "
                "\"plant_name\" (Name of the plant/tree), "
                "\"pest_name\" (Name of the pest/disease), "
                "\"solution_keywords\" (1-2 words summarizing the best treatment, e.g. 'Neem Oil' or 'Pruning'), "
                "\"detailed_analysis\" (Detailed markdown string with solution headings). "
                "If you cannot identify them, use \"Unknown\" for the names."
            )
        elif mode == 'coconut':
            prompt = (
                "You are an expert agricultural AI. "
                "Analyze the provided image of a coconut tree. Count the number of coconuts visible in the image. "
                "You MUST return the output strictly as a valid JSON object with the following keys: "
                "\"plant_name\" (value should be \"Coconut Tree\"), "
                "\"pest_name\" (value should be \"None\"), "
                "\"solution_keywords\" (value should be \"None\"), "
                "\"detailed_analysis\" (Detailed text stating the total count)."
            )
        else:
            return jsonify({'error': 'Invalid mode selected.'}), 400

        response = model.generate_content([prompt, image_part])
        
        # Clean markdown codeblocks from JSON response
        raw_json = response.text.strip()
        if raw_json.startswith("```json"):
            raw_json = raw_json[7:]
        elif raw_json.startswith("```"):
            raw_json = raw_json[3:]
        if raw_json.endswith("```"):
            raw_json = raw_json[:-3]
            
        data = json.loads(raw_json.strip())

        # Image fetching logic using Wikipedia API
        result_data = {
            'detailed_analysis': data.get('detailed_analysis', 'Analysis failed.')
        }

        if mode == 'pest':
            # Fetch Plant Image
            plant_q = data.get('plant_name', '')
            plant_img = fetch_wikipedia_image(plant_q)
            if plant_img: result_data['plant_img'] = plant_img
            result_data['plant_name'] = plant_q

            # Fetch Pest Image
            pest_q = data.get('pest_name', '')
            pest_img = fetch_wikipedia_image(pest_q)
            if pest_img: result_data['pest_img'] = pest_img
            result_data['pest_name'] = pest_q

            # Fetch Solution Image
            sol_q = data.get('solution_keywords', '')
            sol_img = fetch_wikipedia_image(sol_q)
            if sol_img: result_data['solution_img'] = sol_img
            result_data['solution_name'] = sol_q

        return jsonify({'result': result_data})

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
