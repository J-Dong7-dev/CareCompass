import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Client - Lazy initialization for better error handling
  let ai: GoogleGenAI | null = null;
  function getAI() {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return ai;
  }

  /**
   * Endpoint: /api/translate-ui
   * Purpose: Dynamically translates the application's UI strings into any requested language.
   * How it works:
   * 1. Receives the target language and the base English strings.
   * 2. Prompts the Gemini model to return a JSON object with the exact same keys but translated values.
   * 3. The frontend uses this to dynamically replace its static text.
   */
  app.post("/api/translate-ui", async (req, res) => {
    try {
      const { targetLanguage, baseStrings } = req.body;
      
      const client = getAI();
      const prompt = `
        Translate the following JSON object of UI strings into ${targetLanguage}.
        Keep the exact same JSON keys, only translate the values.
        
        ${JSON.stringify(baseStrings, null, 2)}
        
        Return EXACTLY the translated JSON object. Do not include markdown formatting like \`\`\`json.
      `;

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash", // We use flash for quick, cheap, reliable JSON responses
        contents: prompt,
        config: {
          temperature: 0.1, // Low temperature for consistent translation without creative deviations
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error("Error translating UI:", error);
      res.status(500).json({ error: error.message || "Failed to translate UI strings" });
    }
  });

  /**
   * Endpoint: /api/recommendations
   * Purpose: Acts as a mocked geographic and semantic search engine for the patient flow.
   * How it works:
   * 1. It takes the patient's FSA (Postal Code prefix), needs, and preferred language.
   * 2. It queries the Gemini API (acting as our mock database/GIS system) to generate realistic 
   *    community resources for that specific location.
   * 3. It also instructs the AI to translate the resource data into the user's preferred language.
   */
  app.post("/api/recommendations", async (req, res) => {
    try {
      const { fsa, userNeeds, maxDistance, language } = req.body;
      
      if (!fsa || typeof fsa !== 'string' || fsa.length !== 3) {
        return res.status(400).json({ error: "Valid 3-character FSA code is required." });
      }

      const targetLanguage = language || 'English';

      const client = getAI();
      const prompt = `
        You are a healthcare community resource navigator system. Your goal is to redirect non-emergency patients from the ER to local community services.
        Find realistic, representative community mental health, social support, and primary care resources near the Canadian FSA (Forward Sortation Area) code: ${fsa}.
        
        User needs/preferences: ${userNeeds?.join(', ') || 'General mental health and social support'}.
        Distance preference: ${maxDistance ? maxDistance + 'km' : 'Unknown'}.
        
        IMPORTANT: All text in your response (name, description, type, affordability, accessibilityFeatures) MUST BE TRANSLATED into ${targetLanguage}.
        
        Return EXACTLY a JSON array of 3 to 5 realistic community resources. Do NOT return markdown formatting like \`\`\`json. Return only the raw JSON array.
        Each object in the array MUST have the following schema:
        {
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
        }
      `;

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "[]";
      let data = [];
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing JSON from Gemini:", responseText);
        return res.status(500).json({ error: "Failed to parse AI response." });
      }

      res.json({ resources: data });
    } catch (error: any) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred" });
    }
  });

  /**
   * Endpoint: /api/triage
   * Purpose: Acts as a Clinical Decision Support System (CDSS) for healthcare providers.
   * How it works:
   * 1. Takes unstructured clinical notes (symptoms, vitals) and the preferred language.
   * 2. Uses the Gemini model to perform NLP extraction and clinical reasoning, matching the 
   *    input against general medical knowledge to provide a triage recommendation (ED diversion).
   */
  app.post("/api/triage", async (req, res) => {
    try {
      const { symptoms, vitals, language } = req.body;
      const targetLanguage = language || 'English';

      const client = getAI();
      const prompt = `
        You are a Clinical Decision Support System (CDSS) and pre-crisis triage tool designed for healthcare professionals.
        Analyze the following patient presentation:
        Symptoms/Complaint: ${symptoms}
        Vitals/Notes: ${vitals}

        Provide a structured triage assessment.
        IMPORTANT: All text in your response MUST BE TRANSLATED into ${targetLanguage}.
        
        Return EXACTLY a JSON object with this schema:
        {
          "triageLevel": "1-Resuscitation" | "2-Emergent" | "3-Urgent" | "4-Less Urgent" | "5-Non Urgent",
          "recommendedAction": "e.g., Immediate ED transfer, Primary care follow-up, Community resource diversion",
          "clinicalReasoning": "Brief clinical rationale",
          "potentialDifferentials": ["List", "of", "conditions"]
        }
      `;

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing JSON from Gemini:", responseText);
        return res.status(500).json({ error: "Failed to parse AI response." });
      }

      res.json(data);
    } catch (error: any) {
      console.error("Error generating triage:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
