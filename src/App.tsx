import { useState, FormEvent, useEffect } from 'react';
import { Shield, MapPin, Search, Activity, Accessibility, DollarSign, Phone, ChevronRight, CheckCircle2, Layers, Globe, User, Stethoscope, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Resource, TriageResponse } from './types';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapBoundsUpdater({ resources }: { resources: Resource[] }) {
  const map = useMap();
  useEffect(() => {
    if (resources.length > 0) {
      const validResources = resources.filter(r => r.lat && r.lng);
      if (validResources.length > 0) {
        const bounds = L.latLngBounds(validResources.map(r => [Number(r.lat), Number(r.lng)]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [map, resources]);
  return null;
}

// Simple translation dictionary for UI elements
const BASE_UI_STRINGS = {
  selectLanguage: 'Select Language',
  welcomeLanguagePrompt: 'Welcome to CareCompass. What language would you like to proceed in?',
  continue: 'Continue',
  iAmA: 'I am a...',
  patientFamily: 'Patient / Family Member',
  healthcarePro: 'Healthcare Professional',
  patientDesc: 'Looking for local community resources or mental health support.',
  proDesc: 'Clinical Decision Support (CDSS) for pre-crisis triage & referral.',
  privacy: 'Privacy & Security Protocol',
  privacyDesc: 'Patient safety is prioritized. We only require a 3-character FSA code for spatial orientation. No personal health identifiers (PHI) or personally identifiable information (PII) are collected. All data transmission is encrypted, anonymized, and processed in compliance with local healthcare privacy regulations.',
  intake: 'Intake & Requirements',
  fsa: 'Patient Location (FSA)',
  fsaDesc: 'First 3 characters of postal code',
  requirements: 'Care Requirements',
  locate: 'Locate Care Services',
  awaiting: 'Awaiting Intake Data',
  awaitingDesc: 'Enter the patient\'s FSA code and identify their requirements to generate a secure, localized referral pathway.',
  results: 'Validated Community Referrals',
  architecture: 'System Architecture',
  titleProvider: 'Clinical Decision Support (CDSS)',
  titlePatient: 'Community Health Resource Directory',
  changeRole: 'Change Role',
  backToLang: 'Back to Language',
  preCrisis: 'Pre-Crisis Triage (ED Diversion)',
  symptomsLabel: 'Presenting Symptoms / Chief Complaint',
  vitalsLabel: 'Vitals & Context (Optional)',
  generateCdss: 'Generate CDSS Triage',
  cdssAssessment: 'Clinical Decision Support Assessment',
  suggestedTriage: 'Suggested Triage Category',
  recommendedAction: 'Recommended Action',
  clinicalReasoning: 'Clinical Reasoning',
  potentialDifferentials: 'Potential Differentials',
  aiDisclaimer: '⚠️ AI-Generated Tool: For Reference Only. Does not replace clinical judgment.',
  initializingGIS: 'Initializing GIS Mapping...',
  selectedCarePlan: 'Selected for Care Plan',
  selectReferral: 'Select Referral',
  awaitingClinical: 'Awaiting Clinical Data',
  awaitingClinicalDesc: 'Enter patient symptoms and context to generate a pre-crisis AI triage assessment and recommended pathways.',
  verifiedResults: 'verified results'
};

/**
 * Main Application Component
 * Demonstrates a React/TypeScript frontend integrated with a Node/Express backend.
 */
export default function App() {
  // --- Global Application State ---
  // The language input field value
  const [languageInput, setLanguageInput] = useState('');
  // The confirmed language the user wants to proceed in
  const [language, setLanguage] = useState<string | null>(null);
  // Holds the dynamically translated UI strings (defaults to English base strings)
  const [t, setT] = useState<typeof BASE_UI_STRINGS>(BASE_UI_STRINGS);
  const [translating, setTranslating] = useState(false);
  
  // The user's role (patient vs healthcare provider)
  const [role, setRole] = useState<'patient' | 'provider' | null>(null);

  // --- Patient View State ---
  const [fsa, setFsa] = useState('');
  const [needs, setNeeds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [interacted, setInteracted] = useState<Set<string>>(new Set());

  // --- Provider View State ---
  const [symptoms, setSymptoms] = useState('');
  const [vitals, setVitals] = useState('');
  const [triageData, setTriageData] = useState<TriageResponse | null>(null);

  // Core array of support options (this could also be translated dynamically in a full app)
  const NEED_OPTIONS = [
    'Mental Health Counseling',
    'Crisis Support',
    'Substance Use Support',
    'Family/Youth Services',
    'LGBTQIA+ Mental Health Support',
    'Financial Assistance',
    'Housing/Shelter',
    'Accessible Facilities (Wheelchair, etc.)'
  ];

  const handleNeedToggle = (need: string) => {
    setNeeds(prev => 
      prev.includes(need) 
        ? prev.filter(n => n !== need)
        : [...prev, need]
    );
  };

  /**
   * Handle the custom language form submission.
   * Calls the backend to translate the entire UI into the specified language.
   */
  const handleLanguageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!languageInput.trim()) return;

    // If English, we don't need to call the translation API to save time
    if (languageInput.toLowerCase().trim() === 'english') {
      setLanguage('English');
      setT(BASE_UI_STRINGS);
      return;
    }

    setTranslating(true);
    try {
      const res = await fetch('/api/translate-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetLanguage: languageInput.trim(), 
          baseStrings: BASE_UI_STRINGS 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Update UI with the dynamically translated strings
      setT(data);
      setLanguage(languageInput.trim());
    } catch (err: any) {
      console.error('Translation failed:', err);
      // Fallback to English if translation fails
      setLanguage(languageInput.trim());
    } finally {
      setTranslating(false);
    }
  };

  /**
   * Submit handler for the Patient flow.
   * Sends the FSA and selected needs to the backend for mock GIS/NLP processing.
   */
  const handlePatientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fsa || fsa.length !== 3) {
      setError('Please enter a valid 3-character FSA (e.g., M5V).');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResources([]);

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fsa: fsa.toUpperCase(), userNeeds: needs, language })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch recommendations');
      }

      setResources(data.resources);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!symptoms) return;

    setLoading(true);
    setError(null);
    setTriageData(null);

    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms, vitals, language })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate triage');
      }

      setTriageData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInteract = (id: string) => {
    setInteracted(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  };

  if (!language) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-lg w-full border border-slate-700 text-center">
          <Globe className="w-16 h-16 text-blue-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-6 leading-relaxed">
            {BASE_UI_STRINGS.welcomeLanguagePrompt}
          </h1>
          <form onSubmit={handleLanguageSubmit} className="space-y-4">
            <input 
              type="text"
              value={languageInput}
              onChange={(e) => setLanguageInput(e.target.value)}
              placeholder="e.g. English, Español, Français, Tagalog, 廣東話..."
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={translating || !languageInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors border border-blue-500 flex items-center justify-center gap-2"
            >
              {translating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Translating Application...
                </>
              ) : (
                BASE_UI_STRINGS.continue
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <button 
            onClick={() => setLanguage(null)}
            className="text-slate-400 hover:text-white mb-8 flex items-center gap-2 text-sm"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> {t.backToLang || BASE_UI_STRINGS.backToLang}
          </button>
          
          <h1 className="text-3xl font-bold text-white mb-8 text-center">{t.iAmA}</h1>
          
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setRole('patient')}
              className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-blue-500 hover:bg-slate-800/80 transition-all text-left group"
            >
              <div className="bg-blue-500/20 text-blue-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t.patientFamily}</h2>
              <p className="text-slate-400">{t.patientDesc}</p>
            </button>

            <button
              onClick={() => setRole('provider')}
              className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-teal-500 hover:bg-slate-800/80 transition-all text-left group"
            >
              <div className="bg-teal-500/20 text-teal-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t.healthcarePro}</h2>
              <p className="text-slate-400">{t.proDesc}</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-200">
      <header className="bg-white border-b border-neutral-300 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-blue-800">
            <Activity className="w-7 h-7" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {role === 'provider' ? (t.titleProvider || BASE_UI_STRINGS.titleProvider) : (t.titlePatient || BASE_UI_STRINGS.titlePatient)}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium px-3 py-1 bg-neutral-100 rounded-full text-neutral-600">
              {language}
            </div>
            <button 
              onClick={() => { setRole(null); setResources([]); setTriageData(null); }}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              {t.changeRole || BASE_UI_STRINGS.changeRole}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {role === 'patient' && (
          <section className="bg-blue-50 border-l-4 border-blue-700 p-4 flex items-start gap-4 rounded-r-md">
            <div className="text-blue-700 shrink-0 mt-0.5">
              <Shield className="w-6 h-6" />
            </div>
            <div className="text-sm text-neutral-800">
              <h2 className="font-bold text-base mb-1 text-blue-900">{t.privacy}</h2>
              <p className="leading-relaxed">{t.privacyDesc}</p>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            
            {role === 'patient' ? (
              <form onSubmit={handlePatientSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-900 mb-5 border-b border-neutral-200 pb-3">{t.intake}</h3>
                
                <div className="space-y-5">
                  <div>
                    <label htmlFor="fsa" className="block text-sm font-bold text-neutral-700 mb-1.5">
                      {t.fsa}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        id="fsa"
                        type="text"
                        maxLength={3}
                        placeholder="e.g. M5V"
                        value={fsa}
                        onChange={(e) => setFsa(e.target.value.toUpperCase())}
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600 uppercase tracking-widest text-neutral-900 font-medium placeholder:text-neutral-400 placeholder:font-normal"
                        required
                      />
                    </div>
                    <p className="text-xs text-neutral-500 mt-1.5 font-medium">{t.fsaDesc}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-3">
                      {t.requirements}
                    </label>
                    <div className="space-y-2.5">
                      {NEED_OPTIONS.map(need => (
                        <label key={need} className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-start mt-0.5">
                            <input
                              type="checkbox"
                              checked={needs.includes(need)}
                              onChange={() => handleNeedToggle(need)}
                              className="w-4 h-4 text-blue-700 border-neutral-300 rounded focus:ring-blue-600"
                            />
                          </div>
                          <span className="text-sm text-neutral-700 group-hover:text-neutral-900 font-medium">
                            {need}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || fsa.length !== 3}
                    className="w-full mt-6 bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        {t.locate}
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleProviderSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-900 mb-5 border-b border-neutral-200 pb-3">{t.preCrisis || BASE_UI_STRINGS.preCrisis}</h3>
                
                <div className="space-y-5">
                  <div>
                    <label htmlFor="symptoms" className="block text-sm font-bold text-neutral-700 mb-1.5">
                      {t.symptomsLabel || BASE_UI_STRINGS.symptomsLabel}
                    </label>
                    <textarea
                      id="symptoms"
                      rows={4}
                      placeholder="..."
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-neutral-900"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="vitals" className="block text-sm font-bold text-neutral-700 mb-1.5">
                      {t.vitalsLabel || BASE_UI_STRINGS.vitalsLabel}
                    </label>
                    <textarea
                      id="vitals"
                      rows={2}
                      placeholder="..."
                      value={vitals}
                      onChange={(e) => setVitals(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-neutral-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !symptoms}
                    className="w-full mt-6 bg-teal-700 hover:bg-teal-800 text-white font-bold py-3 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Activity className="w-5 h-5" />
                        {t.generateCdss || BASE_UI_STRINGS.generateCdss}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white p-5 rounded-lg border border-neutral-200 shadow-sm text-sm">
              <div className="flex items-center gap-2 mb-3 text-neutral-900 font-bold border-b border-neutral-100 pb-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h4>{t.architecture}</h4>
              </div>
              <ul className="space-y-3 text-neutral-600">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Node.js/React:</strong> Core routing, UI presentation, and state management.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Python NLP Engine:</strong> Processes complex clinical notes to match patient needs to resource descriptions and provide CDSS triage.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span><strong>C++ GIS Module:</strong> High-performance geospatial routing, walkability scoring, and regional proximity calculations.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {role === 'patient' && (resources.length > 0 || loading) && (
               <div className="bg-white p-2 rounded-lg border border-neutral-200 shadow-sm h-[350px] relative z-0">
                  {loading ? (
                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center rounded text-neutral-400 font-medium">
                      {t.initializingGIS || BASE_UI_STRINGS.initializingGIS}
                    </div>
                  ) : (
                    <MapContainer 
                      center={[43.6532, -79.3832]} // Default to Toronto general area, updated by MapBoundsUpdater
                      zoom={12} 
                      className="w-full h-full rounded"
                      zoomControl={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {resources.map((resource) => (
                        resource.lat && resource.lng ? (
                          <Marker key={`marker-${resource.id}`} position={[Number(resource.lat), Number(resource.lng)]}>
                            <Popup>
                              <div className="font-bold text-sm mb-1">{resource.name}</div>
                              <div className="text-xs text-neutral-600">{resource.type}</div>
                            </Popup>
                          </Marker>
                        ) : null
                      ))}
                      <MapBoundsUpdater resources={resources} />
                    </MapContainer>
                  )}
               </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-800 p-4 rounded-md border-l-4 border-red-600 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">System Error:</span> {error}
                </div>
              </div>
            )}

            {!loading && !error && resources.length === 0 && !triageData && !fsa && !symptoms && (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-lg border border-neutral-200 border-dashed shadow-sm">
                <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mb-4">
                  {role === 'patient' ? <Search className="w-8 h-8" /> : <Stethoscope className="w-8 h-8" />}
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {role === 'patient' ? t.awaiting : (t.awaitingClinical || BASE_UI_STRINGS.awaitingClinical)}
                </h3>
                <p className="text-neutral-500 max-w-sm">
                  {role === 'patient' ? t.awaitingDesc : (t.awaitingClinicalDesc || BASE_UI_STRINGS.awaitingClinicalDesc)}
                </p>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white p-6 rounded-lg border border-neutral-200 shadow-sm animate-pulse flex flex-col gap-4">
                    <div className="flex gap-4 items-start">
                      <div className="w-12 h-12 bg-neutral-200 rounded"></div>
                      <div className="flex-1 space-y-2.5">
                        <div className="h-5 bg-neutral-200 rounded w-1/3"></div>
                        <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
                      </div>
                    </div>
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            )}

            {role === 'provider' && !loading && triageData && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-neutral-900">
                    {t.cdssAssessment || BASE_UI_STRINGS.cdssAssessment}
                  </h3>
                </div>
                
                <div className="bg-white p-8 rounded-lg border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-200">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-teal-100 text-teal-700 font-bold text-xl border-4 border-teal-50">
                      {triageData.triageLevel.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-teal-900">{triageData.triageLevel}</h4>
                      <p className="text-neutral-500 font-medium mt-1">{t.suggestedTriage || BASE_UI_STRINGS.suggestedTriage}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h5 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">{t.recommendedAction || BASE_UI_STRINGS.recommendedAction}</h5>
                      <div className="bg-teal-50 border border-teal-200 rounded-md p-4 text-teal-900 font-semibold text-lg">
                        {triageData.recommendedAction}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">{t.clinicalReasoning || BASE_UI_STRINGS.clinicalReasoning}</h5>
                      <p className="text-neutral-800 leading-relaxed text-lg">
                        {triageData.clinicalReasoning}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">{t.potentialDifferentials || BASE_UI_STRINGS.potentialDifferentials}</h5>
                      <div className="flex flex-wrap gap-2">
                        {triageData.potentialDifferentials.map((diff, i) => (
                          <span key={i} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 font-medium rounded text-sm border border-neutral-200">
                            {diff}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-neutral-200 text-xs text-neutral-400 font-medium uppercase tracking-wide">
                    {t.aiDisclaimer || BASE_UI_STRINGS.aiDisclaimer}
                  </div>
                </div>
              </div>
            )}

            {role === 'patient' && !loading && resources.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-neutral-900">
                    {t.results}
                  </h3>
                  <span className="text-sm font-medium bg-blue-100 text-blue-800 py-1 px-3 rounded-full">
                    {resources.length} {t.verifiedResults || BASE_UI_STRINGS.verifiedResults}
                  </span>
                </div>
                
                {resources.map(resource => (
                  <div 
                    key={resource.id} 
                    className={`bg-white p-6 rounded-lg border shadow-sm transition-all ${
                      interacted.has(resource.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700">
                            {resource.type}
                          </span>
                        </div>
                        <h4 className="text-xl font-bold text-blue-900 mb-2">{resource.name}</h4>
                        <p className="text-neutral-700 text-sm mb-4 leading-relaxed font-medium">
                          {resource.description}
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm text-neutral-600 mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="truncate">{resource.address}</span>
                            <span className="text-neutral-300">•</span>
                            <span className="font-semibold text-neutral-800">{resource.distanceEstimate}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span>{resource.affordability}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span>{resource.contactInfo}</span>
                          </div>
                        </div>

                        {resource.accessibilityFeatures?.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap mb-4">
                            <Accessibility className="w-4 h-4 text-blue-700" />
                            {resource.accessibilityFeatures.map((feat, i) => (
                              <span key={i} className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                {feat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 mt-2 sm:mt-0">
                        <button 
                          onClick={() => handleInteract(resource.id)}
                          className={`w-full sm:w-auto px-5 py-2.5 rounded font-bold transition-colors flex items-center justify-center gap-2 text-sm ${
                            interacted.has(resource.id) 
                              ? 'bg-blue-50 text-blue-800 border-2 border-blue-200' 
                              : 'bg-white border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300'
                          }`}
                        >
                          {interacted.has(resource.id) 
                            ? (t.selectedCarePlan || BASE_UI_STRINGS.selectedCarePlan) 
                            : (t.selectReferral || BASE_UI_STRINGS.selectReferral)}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
