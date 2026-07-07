export interface Resource {
  id: string;
  name: string;
  type: "Mental Health Clinic" | "Support Group" | "Social Service" | "Primary Care" | string;
  description: string;
  address: string;
  distanceEstimate: string;
  affordability: string;
  accessibilityFeatures: string[];
  contactInfo: string;
  lat: number;
  lng: number;
}

export interface RecommendationRequest {
  fsa: string;
  userNeeds: string[];
  maxDistance?: number;
  language?: string;
}

export interface TriageResponse {
  triageLevel: string;
  recommendedAction: string;
  clinicalReasoning: string;
  potentialDifferentials: string[];
}
