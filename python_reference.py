"""
CareCompass Architecture - Python Reference Implementation

This script demonstrates how the Node.js/Express backend (server.ts) could be implemented 
in Python using FastAPI and the google-genai library.

Requirements:
- pip install fastapi uvicorn google-genai pydantic
- export GEMINI_API_KEY="your-api-key"

To run:
- uvicorn python_reference:app --reload --port 3000
"""

import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from google import genai

# Define the FastAPI app instance
app = FastAPI(title="CareCompass Backend")

# Initialize Gemini client
# Note: google-genai automatically picks up GEMINI_API_KEY from environment variables
try:
    client = genai.Client()
except Exception as e:
    print("Warning: Failed to initialize Gemini Client. Make sure GEMINI_API_KEY is set.")

# --- Pydantic Models for Request Validation ---

class TranslationRequest(BaseModel):
    targetLanguage: str
    baseStrings: Dict[str, str]

class RecommendationRequest(BaseModel):
    fsa: str
    userNeeds: Optional[List[str]] = None
    maxDistance: Optional[int] = None
    language: Optional[str] = "English"

class TriageRequest(BaseModel):
    symptoms: str
    vitals: Optional[str] = None
    language: Optional[str] = "English"


# --- API Routes ---

@app.post("/api/translate-ui")
def translate_ui(request: TranslationRequest):
    """
    Translates the base English UI strings into the requested target language.
    """
    try:
        prompt = f"""
        Translate the following JSON object of UI strings into {request.targetLanguage}.
        Keep the exact same JSON keys, only translate the values.
        
        {json.dumps(request.baseStrings, indent=2)}
        
        Return EXACTLY the translated JSON object. Do not include markdown formatting like ```json.
        """
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        )
        
        # Parse the JSON returned by Gemini
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Error in translate_ui: {e}")
        raise HTTPException(status_code=500, detail="Failed to translate UI strings")


@app.post("/api/recommendations")
def get_recommendations(request: RecommendationRequest):
    """
    Generates community resource recommendations based on the patient's geographic 
    location (FSA) and needs. Instructs the model to output in the requested language.
    """
    if len(request.fsa) != 3:
        raise HTTPException(status_code=400, detail="Valid 3-character FSA code is required.")
        
    try:
        needs_str = ", ".join(request.userNeeds) if request.userNeeds else 'General mental health and social support'
        distance_str = f"{request.maxDistance}km" if request.maxDistance else 'Unknown'
        
        prompt = f"""
        You are a healthcare community resource navigator system. Your goal is to redirect non-emergency patients from the ER to local community services.
        Find realistic, representative community mental health, social support, and primary care resources near the Canadian FSA (Forward Sortation Area) code: {request.fsa}.
        
        User needs/preferences: {needs_str}.
        Distance preference: {distance_str}.
        
        IMPORTANT: All text in your response (name, description, type, affordability, accessibilityFeatures) MUST BE TRANSLATED into {request.language}.
        
        Return EXACTLY a JSON array of 3 to 5 realistic community resources. Do NOT return markdown formatting like ```json. Return only the raw JSON array.
        Each object in the array MUST have the following schema:
        {{
          "id": "unique-string",
          "name": "Name of the clinic, group, or service",
          "type": "Mental Health Clinic" | "Support Group" | "Social Service" | "Primary Care",
          "description": "Brief description of the services offered",
          "address": "Street address or general location in the FSA",
          "distanceEstimate": "Estimated distance (e.g. '1.2 km')",
          "affordability": "Free" | "Sliding Scale" | "Covered by OHIP/Provincial" | "Paid",
          "accessibilityFeatures": ["Wheelchair Accessible", "Transit Nearby", etc...],
          "contactInfo": "Phone number or website (realistic placeholder)",
          "lat": "number (latitude, realistic for the FSA)",
          "lng": "number (longitude, realistic for the FSA)"
        }}
        """
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        )
        
        data = json.loads(response.text)
        return {"resources": data}
        
    except Exception as e:
        print(f"Error in recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


@app.post("/api/triage")
def get_triage(request: TriageRequest):
    """
    Acts as a Clinical Decision Support System (CDSS) for healthcare providers.
    Uses NLP extraction and clinical reasoning to provide an ED diversion recommendation.
    """
    try:
        prompt = f"""
        You are a Clinical Decision Support System (CDSS) and pre-crisis triage tool designed for healthcare professionals.
        Analyze the following patient presentation:
        Symptoms/Complaint: {request.symptoms}
        Vitals/Notes: {request.vitals or 'None'}

        Provide a structured triage assessment.
        IMPORTANT: All text in your response MUST BE TRANSLATED into {request.language}.
        
        Return EXACTLY a JSON object with this schema:
        {{
          "triageLevel": "1-Resuscitation" | "2-Emergent" | "3-Urgent" | "4-Less Urgent" | "5-Non Urgent",
          "recommendedAction": "e.g., Immediate ED transfer, Primary care follow-up, Community resource diversion",
          "clinicalReasoning": "Brief clinical rationale",
          "potentialDifferentials": ["List", "of", "conditions"]
        }}
        """
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        )
        
        data = json.loads(response.text)
        return data
        
    except Exception as e:
        print(f"Error in triage: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate triage")
