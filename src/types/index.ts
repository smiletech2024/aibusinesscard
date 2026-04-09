export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Persona {
  id: string
  user_id: string
  values_summary: string | null
  tone_profile: string | null
  faq_json: FAQ[]
  achievements_json: Achievement[]
  forbidden_rules_json: string[]
  routing_rules_json: RoutingRule[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FAQ {
  question: string
  answer: string
}

export interface Achievement {
  title: string
  description: string
}

export interface RoutingRule {
  intent: string
  action: string
}

export interface BusinessCard {
  id: string
  user_id: string
  persona_id: string | null
  image_url: string | null
  full_name: string
  title: string | null
  company: string | null
  short_intro: string | null
  email: string | null
  phone: string | null
  website: string | null
  qr_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  profiles?: Profile
  personas?: Persona
}

export interface CustomerSession {
  id: string
  persona_id: string
  card_id: string | null
  customer_name: string | null
  customer_email: string | null
  status: 'ai_chat' | 'summarized' | 'owner_chat' | 'closed'
  intent: string | null
  summary_id: string | null
  created_at: string
  updated_at: string
  personas?: Persona & { profiles?: Profile }
  business_cards?: BusinessCard
}

export interface AiConversation {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ConversationSummary {
  id: string
  session_id: string
  purpose: string | null
  problems: string | null
  interests: string | null
  compatibility_score: string | null
  unresolved_points: string | null
  next_action: string | null
  raw_summary: string | null
  created_at: string
}

export interface HumanChat {
  id: string
  session_id: string
  sender_role: 'owner' | 'customer'
  content: string
  created_at: string
}
