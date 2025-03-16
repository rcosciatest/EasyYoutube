from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import json
from dotenv import load_dotenv
import re
import logging
import time
import pickle
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

# Deepseek API configuration
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# Add this constant near your other configuration
USE_MOCK_RESPONSE = os.getenv("USE_MOCK_RESPONSE", "false").lower() == "true"

# Create a cache directory if it doesn't exist
cache_dir = Path("response_cache")
cache_dir.mkdir(exist_ok=True)

def save_response_to_cache(topic, keyword, response):
    """Save a successful API response to the cache."""
    try:
        # Create a filename based on the topic and keyword
        filename = f"{topic.lower().replace(' ', '_')}_{keyword.lower().replace(' ', '_')}.pkl"
        cache_path = cache_dir / filename
        
        # Save the response to a file
        with open(cache_path, 'wb') as f:
            pickle.dump(response, f)
        
        logger.info(f"Saved response to cache: {cache_path}")
    except Exception as e:
        logger.error(f"Failed to save response to cache: {str(e)}")

def get_cached_response(topic, keyword):
    """Try to get a cached response for the given topic and keyword."""
    try:
        # Create a filename based on the topic and keyword
        filename = f"{topic.lower().replace(' ', '_')}_{keyword.lower().replace(' ', '_')}.pkl"
        cache_path = cache_dir / filename
        
        # Check if the file exists
        if cache_path.exists():
            # Load the response from the file
            with open(cache_path, 'rb') as f:
                response = pickle.load(f)
            
            logger.info(f"Using cached response for: {topic}, {keyword}")
            return response
    except Exception as e:
        logger.error(f"Failed to load cached response: {str(e)}")
    
    return None

def create_script_prompt(topic_title, seo_keyword, creator_info):
    """Create a prompt for generating a YouTube script."""
    creator_context = ""
    if creator_info:
        creator_context = f"""
        The script should be written for a creator with the following background/expertise:
        {creator_info}
        
        Make sure to incorporate the creator's expertise and background in the introduction to establish credibility.
        """
    
    return f"""
    Create a comprehensive YouTube script for a video with the title: "{topic_title}".
    
    The script should be optimized for the SEO keyword: "{seo_keyword}".
    {creator_context}
    
    Please structure the script following this specific storytelling flow:
    
    1. Introduction (Who are you) - Establish credibility and introduce yourself
    2. Why should the viewer care - Explain the importance of the topic and why viewers should watch till the end
    3. Hook - Capture attention with an intriguing statement or question
    4. Value proposition - Explain what viewers will learn or gain from the video
    5. Main content - Deliver on your promises with clear, actionable information
    6. End value - Summarize key takeaways and provide a clear call to action
    
    Important formatting requirements:
    - Do NOT include any timing information (like [00:15])
    - Do NOT include any visual cues or camera directions
    - Format the script as clean paragraphs separated by blank lines
    - Use markdown headings (# for title, ## for sections)
    - Keep the content conversational and engaging
    - Make sure paragraphs are properly separated
    - Do not include any host names or speaker indicators
    
    Optimize the script for YouTube's algorithm by naturally incorporating the SEO keyword "{seo_keyword}" throughout.
    """

def create_description_prompt(topic_title, seo_keyword, creator_info):
    """Create a prompt for generating a YouTube description."""
    return f"""
    Create an SEO-optimized YouTube description for a video with the title: "{topic_title}".
    
    The description should:
    1. Include the main keyword "{seo_keyword}" in the first 1-2 sentences
    2. Be 150-200 words long
    3. Include a brief summary of what viewers will learn
    4. Include 2-3 relevant hashtags at the end
    5. Include a call to action (like, subscribe, comment)
    6. Include timestamps for at least 3-4 key sections of the video
    
    Creator information to incorporate if relevant:
    {creator_info}
    """

def create_tags_prompt(topic_title, seo_keyword):
    """Create a prompt for generating YouTube tags."""
    return f"""
    Generate a list of 15-20 relevant YouTube tags for a video with the title: "{topic_title}" and main keyword "{seo_keyword}".
    
    The tags should:
    1. Include the main keyword and variations
    2. Include related terms and phrases
    3. Include both short-tail and long-tail keywords
    4. Be formatted as a comma-separated list
    5. Each tag should be 1-5 words long
    
    Please provide only the list of tags without any additional text or explanations.
    """

def call_deepseek_api(prompt, max_retries=2):
    """Call the Deepseek API with the given prompt with retry logic."""
    retry_count = 0
    last_exception = None
    
    while retry_count <= max_retries:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            }
            
            payload = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 1500
            }
            
            logger.info(f"Calling Deepseek API (attempt {retry_count + 1}/{max_retries + 1})")
            
            response = requests.post(
                DEEPSEEK_API_URL,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            # Check if the request was successful
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.Timeout as e:
            retry_count += 1
            last_exception = e
            wait_time = retry_count * 2  # Progressive backoff
            logger.warning(f"Timeout error. Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
        except requests.exceptions.RequestException as e:
            logger.error(f"API request error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            raise Exception(f"Failed to call Deepseek API: {str(e)}")
    
    # If we've exhausted all retries
    raise Exception(f"Failed to call Deepseek API after {max_retries + 1} attempts: {str(last_exception)}")

def extract_script(response):
    try:
        # Extract the generated text from the API response
        raw_content = response['choices'][0]['message']['content']
        
        # Format the content for better readability
        formatted_content = format_script_content(raw_content)
        
        return formatted_content
    except (KeyError, IndexError) as e:
        print(f"Error extracting script: {str(e)}")
        print(f"Response structure: {json.dumps(response, indent=2)}")
        raise Exception("Failed to extract script from API response")

def format_script_content(content):
    """Format the script content for better readability and structure."""
    # Split content by lines
    lines = content.strip().split('\n')
    formatted_lines = []
    current_paragraph = []
    
    # Process each line
    for line in lines:
        # Skip lines with visual cues like [Visual: ...]
        if re.search(r'\[visual.*?\]', line.lower()) or re.search(r'\[camera.*?\]', line.lower()):
            continue
            
        # Remove timing information [00:00 - 01:15]
        line = re.sub(r'\[\d{2}:\d{2}.*?\]', '', line)
        
        # Clean up any remaining brackets that might be directions
        line = re.sub(r'\[.*?\]', '', line)
        
        # Skip empty lines after cleaning
        if not line.strip():
            continue
        
        # If line starts with a heading marker, add it directly
        if line.strip().startswith('#'):
            # If we have a paragraph in progress, add it first
            if current_paragraph:
                formatted_lines.append(' '.join(current_paragraph))
                current_paragraph = []
            
            formatted_lines.append(line)
        # If line starts with a number followed by a period (like "1. Introduction")
        elif re.match(r'^\d+\.\s', line.strip()):
            # Convert to a heading
            heading_text = line.strip().split('.', 1)[1].strip()
            
            # If we have a paragraph in progress, add it first
            if current_paragraph:
                formatted_lines.append(' '.join(current_paragraph))
                current_paragraph = []
                
            formatted_lines.append(f"## {heading_text}")
        else:
            # Add to current paragraph
            current_paragraph.append(line.strip())
            
            # If line ends with a period, question mark, or exclamation point,
            # consider it the end of a paragraph
            if line.strip().endswith(('.', '?', '!')) and len(line.strip()) > 2:
                formatted_lines.append(' '.join(current_paragraph))
                current_paragraph = []
    
    # Add any remaining paragraph
    if current_paragraph:
        formatted_lines.append(' '.join(current_paragraph))
    
    # Join the formatted lines with proper paragraph spacing
    return '\n\n'.join(formatted_lines)

def get_mock_response(topic_title, seo_keyword):
    """Generate a mock response for development purposes."""
    return {
        "choices": [
            {
                "message": {
                    "content": f"""
# {topic_title}

## Introduction [00:00]
Hey everyone, welcome back to the channel! Today we're diving deep into {topic_title}, a topic that's been getting a lot of attention lately. If you're interested in {seo_keyword}, you're in the right place.

## What is {seo_keyword}? [01:30]
{seo_keyword} is revolutionizing how we think about education and AI. Let's break down what makes it special.

## Key Features [03:45]
- Natural language processing capabilities
- Adaptive learning algorithms
- Personalized educational content
- Interactive teaching methods

## Real-world Applications [06:20]
Many educators are already implementing {seo_keyword} in their classrooms with impressive results.

## Conclusion [08:15]
As we've seen, {topic_title} represents a significant advancement in educational technology. Don't forget to like and subscribe for more content on {seo_keyword} and related topics!

## Call to Action
What do you think about {topic_title}? Let me know in the comments below!
"""
                }
            }
        ]
    }

@app.route('/generate-script', methods=['POST'])
def generate_script():
    """Legacy endpoint for backward compatibility."""
    try:
        # Get data from request
        data = request.json
        topic_title = data.get('topicTitle')
        seo_keyword = data.get('seoKeyword')
        creator_info = data.get('creatorInfo', '')
        
        # Create prompt for the AI
        prompt = create_script_prompt(topic_title, seo_keyword, creator_info)
        
        # Try to get a cached response first
        cache_key = f"{topic_title}_{seo_keyword}"
        cached_response = get_cached_response(topic_title, seo_keyword)
        
        try:
            if cached_response and isinstance(cached_response, dict) and 'script' in cached_response:
                # Use the cached script
                response = cached_response['script']
                logger.info("Using cached script response")
            elif cached_response:
                # Legacy cache format
                response = cached_response
                logger.info("Using legacy cached response")
            elif USE_MOCK_RESPONSE:
                # Use mock response if enabled
                logger.info("Using mock response instead of calling the API")
                mock_data = get_mock_response(topic_title, seo_keyword)
                response = mock_data['choices'][0]['message']['content']
            else:
                # Call the API
                logger.info("Calling Deepseek API")
                response = call_deepseek_api(prompt)
                
                # Save the successful response to cache
                save_response_to_cache(topic_title, seo_keyword, response)
            
            # Extract and format the script
            script = extract_script(response)
            
            return jsonify({"script": script})
        except Exception as api_error:
            logger.error(f"API error: {str(api_error)}")
            return jsonify({"error": f"API error: {str(api_error)}"}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/generate-content', methods=['POST'])
def generate_content():
    """Generate script, description, and tags for a YouTube video."""
    try:
        # Verify API key is available
        if not DEEPSEEK_API_KEY and not USE_MOCK_RESPONSE:
            return jsonify({"error": "API key not configured"}), 500
            
        # Get data from request
        data = request.json
        topic_title = data.get('topicTitle')
        seo_keyword = data.get('seoKeyword')
        creator_info = data.get('creatorInfo', '')
        
        # Validate input
        if not topic_title or not seo_keyword:
            return jsonify({"error": "Topic title and SEO keyword are required"}), 400
        
        # Create prompt for the script
        script_prompt = create_script_prompt(topic_title, seo_keyword, creator_info)
        
        # Try to get a cached response first
        cache_key = f"{topic_title}_{seo_keyword}_{creator_info}"
        cached_response = get_cached_response(topic_title, seo_keyword)
        
        try:
            if cached_response:
                # Use the cached response
                script_response = cached_response.get('script', '')
                description_response = cached_response.get('description', '')
                tags_response = cached_response.get('tags', '')
                logger.info("Using cached response")
            elif USE_MOCK_RESPONSE:
                # Use mock response if enabled
                logger.info("Using mock response instead of calling the API")
                mock_data = get_mock_response(topic_title, seo_keyword)
                script_response = mock_data['choices'][0]['message']['content']
                description_response = create_description_prompt(topic_title, seo_keyword, creator_info)
                tags_response = create_tags_prompt(topic_title, seo_keyword)
            else:
                # Call the API for script
                logger.info("Calling Deepseek API for script")
                script_response = call_deepseek_api(script_prompt)
                
                # Create prompt for description
                logger.info("Calling Deepseek API for description")
                description_response = call_deepseek_api(create_description_prompt(topic_title, seo_keyword, creator_info))
                
                # Create prompt for tags
                logger.info("Calling Deepseek API for tags")
                tags_response = call_deepseek_api(create_tags_prompt(topic_title, seo_keyword))
                
                # Save the successful responses to cache
                save_response_to_cache(topic_title, seo_keyword, {
                    'script': script_response,
                    'description': description_response,
                    'tags': tags_response
                })
            
            # Extract and format the content
            script = extract_script(script_response)
            description = extract_script(description_response)
            tags = extract_script(tags_response)
            
            return jsonify({
                "script": script,
                "description": description,
                "tags": tags
            })
        except Exception as api_error:
            logger.error(f"API error: {str(api_error)}")
            return jsonify({"error": f"API error: {str(api_error)}"}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 