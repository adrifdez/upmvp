export const SYSTEM_PROMPT = `Eres el asistente virtual de MidHome Rentals, una empresa especializada en alquileres de media estancia (1-6 meses) en las mejores zonas de la ciudad.

Tu rol principal tiene dos objetivos:
1. VENDER: Convertir interesados en inquilinos, destacando nuestras ventajas y cerrando reservas
2. GESTIONAR: Dar soporte eficiente a inquilinos actuales durante su estancia

Características de comunicación:
- Responde siempre en español
- Sé profesional pero cercano y amigable
- Usa un tono entusiasta para ventas, resolutivo para soporte
- Personaliza las respuestas según el contexto
- Si no puedes resolver algo, indica el siguiente paso claramente

Información de la empresa:
- Horario atención: Lunes a Viernes 9:00-18:00
- Teléfono emergencias 24h: 600-123-456
- Email: soporte@midsomerentals.es
- Todos los pisos incluyen: WiFi fibra, suministros, limpieza semanal, cocina equipada, mantenimiento`;

export const COMPANY_INFO = {
  name: 'MidHome Rentals',
  businessHours: 'Lunes a Viernes 9:00-18:00',
  emergencyPhone: '600-123-456',
  email: 'soporte@midsomerentals.es',
  amenities: ['WiFi fibra', 'suministros', 'limpieza semanal', 'cocina equipada', 'mantenimiento']
};

export const LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 500
};

export const GUIDELINE_CONFIG = {
  maxGuidelinesPerResponse: 3,
  fatigueFactor: 0.95,
  recentMessagesContext: 3
};

export enum GUIDELINE_CATEGORIES {
  VENTAS = 'ventas',
  GESTION = 'gestion',
  GENERAL = 'general',
  GREETINGS = 'greetings',
  SUPPORT = 'support',
  SALES = 'sales',
  PRIORITY = 'priority',
  TECHNICAL = 'technical'
}

export const GUIDELINE_TITLES: Record<string, string> = {
  [GUIDELINE_CATEGORIES.VENTAS]: 'GUIDELINES DE VENTA:',
  [GUIDELINE_CATEGORIES.GESTION]: 'GUIDELINES DE GESTIÓN:',
  [GUIDELINE_CATEGORIES.GENERAL]: 'GUIDELINES GENERALES:'
};

export function buildGuidelinePrompt(basePrompt: string, guidelineInstructions: string): string {
  if (!guidelineInstructions) {
    return basePrompt;
  }
  
  return `${basePrompt}

Aplica las siguientes guidelines según el contexto:

${guidelineInstructions}

Recuerda: Integra estas guidelines de forma natural en tus respuestas, sin mencionarlas explícitamente.`;
}

export type GuidelineCategory = GUIDELINE_CATEGORIES;

// Matching Service Constants

export interface ConversationFlow {
  from: string;
  to: string;
  boost: number;
}

// Solo español para MVP de alquileres
export const CATEGORY_PATTERNS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  [GUIDELINE_CATEGORIES.VENTAS]: Object.freeze(['precio', 'costo', 'cuánto cuesta', 'tarifa', 'alquiler', 'disponible', 
                          'zona', 'ubicación', 'barrio', 'ver piso', 'visita', 'reservar']),
  [GUIDELINE_CATEGORIES.GESTION]: Object.freeze(['avería', 'problema', 'roto', 'no funciona', 'arreglar', 'técnico',
                           'pago', 'factura', 'recibo', 'agua', 'luz', 'calefacción', 'emergencia']),
  [GUIDELINE_CATEGORIES.GENERAL]: Object.freeze(['hola', 'buenos días', 'buenas tardes', 'gracias', 'adiós', 'información'])
});

export const CONVERSATION_FLOWS: readonly ConversationFlow[] = Object.freeze([
  { from: GUIDELINE_CATEGORIES.VENTAS, to: GUIDELINE_CATEGORIES.VENTAS, boost: 20 }, // Continuidad en proceso de venta
  { from: GUIDELINE_CATEGORIES.GENERAL, to: GUIDELINE_CATEGORIES.VENTAS, boost: 15 }, // De saludo a venta
  { from: GUIDELINE_CATEGORIES.GESTION, to: GUIDELINE_CATEGORIES.GESTION, boost: 20 }, // Continuidad en soporte
]);

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Patrones de verbos en español para el contexto de alquileres
export const SPANISH_VERB_PATTERNS = [
  // Patrones de consulta
  { pattern: /pregunta?\s+(?:sobre\s+|por\s+)?(\w+)/, score: 50 },
  { pattern: /quiere?\s+(?:saber\s+|conocer\s+)?(\w+)/, score: 45 },
  { pattern: /necesita?\s+(\w+)/, score: 45 },
  { pattern: /busca?\s+(\w+)/, score: 45 },
  { pattern: /interesa?\s+(\w+)/, score: 45 },
  
  // Patrones de reporte/problema
  { pattern: /reporta?\s+(\w+)/, score: 50 },
  { pattern: /tiene?\s+(?:un\s+)?problema/, score: 50 },
  { pattern: /hay\s+(?:un\s+)?(\w+)/, score: 45 },
  { pattern: /no\s+funciona/, score: 50 },
  
  // Patrones de acción
  { pattern: /quiere?\s+(?:ver\s+|visitar\s+)?(\w+)/, score: 45 },
  { pattern: /solicita?\s+(\w+)/, score: 45 },
  { pattern: /pide?\s+(\w+)/, score: 45 },
  
  // Patrones generales
  { pattern: /menciona?\s+(\w+)/, score: 40 },
  { pattern: /dice?\s+(\w+)/, score: 40 },
  { pattern: /habla?\s+(?:de\s+|sobre\s+)?(\w+)/, score: 40 }
];

// Palabras clave para el contexto de alquileres
export const SPANISH_ACTION_WORDS = {
  'saluda': ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'buenas', 'saludos'],
  'saludo': ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'buenas'],
  'precio': ['precio', 'costo', 'cuánto cuesta', 'tarifa', 'valor', 'cuesta', 'costar', 'vale', 'cuánto'],
  'disponible': ['disponible', 'disponibilidad', 'libre', 'alquilar', 'alquiler', 'busco', 'buscando'],
  'alquileres': ['alquiler', 'alquilar', 'piso', 'estudio', 'apartamento', 'habitación'],
  'ubicacion': ['zona', 'ubicación', 'barrio', 'dónde', 'dirección', 'cerca', 'metro', 'centro'],
  'visita': ['ver', 'visitar', 'visita', 'conocer', 'enseñar', 'mostrar'],
  'reserva': ['reservar', 'reserva', 'apartar', 'contratar', 'alquilar'],
  'incluye': ['incluye', 'incluido', 'servicios', 'qué tiene', 'qué trae'],
  'requisitos': ['requisitos', 'documentos', 'documentación', 'necesito', 'piden'],
  'avería': ['avería', 'roto', 'no funciona', 'arreglar', 'falla', 'daño', 'estropeado', 'lavadora', 'nevera'],
  'reporta': ['reportar', 'informar', 'avisar', 'decir', 'comentar'],
  'problemas': ['problema', 'problemas', 'fallo', 'mal', 'error'],
  'agua': ['agua', 'agua caliente', 'agua fría', 'grifo', 'ducha'],
  'luz': ['luz', 'electricidad', 'corriente', 'bombilla', 'interruptor'],
  'calefacción': ['calefacción', 'calor', 'radiador', 'frío'],
  'urgente': ['urgente', 'emergencia', 'urgencia', 'ahora', 'inmediatamente', 'rápido'],
  'pago': ['pago', 'pagar', 'factura', 'recibo', 'cuota', 'mensualidad'],
  'salida': ['salida', 'check-out', 'irme', 'dejar', 'terminar contrato', 'fin contrato'],
  'renovar': ['renovar', 'extender', 'continuar', 'quedarme más', 'ampliar']
};

// Palabras comunes en español que se ignoran en el matching
export const SPANISH_COMMON_WORDS = ['el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'de', 'del', 
                        'al', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'y', 'o',
                        'que', 'en', 'a', 'se'];

// Expresiones regulares para limpiar condiciones en español
export const SPANISH_CONDITION_CLEANERS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /cuando\s+el\s+usuario\s+/g, replacement: '' },
  { pattern: /cuando\s+usuario\s+/g, replacement: '' },
  { pattern: /cuando\s+un\s+inquilino\s+/g, replacement: '' },
  { pattern: /cuando\s+alguien\s+/g, replacement: '' },
  { pattern: /cuando\s+hay\s+/g, replacement: 'hay ' }, // Mantener "hay" si es parte de la condición
  { pattern: /cuando\s+/g, replacement: '' },
  { pattern: /\s+/g, replacement: ' ' }
];