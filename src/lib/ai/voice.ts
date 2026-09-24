// ============================================================
// Assistant Vocal — SENTINEL'S AI (Web Speech API natif)
// ============================================================

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
}

export const isVoiceRecognitionSupported = isSpeechRecognitionSupported;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let activeRecognition: any = null;

export interface VoiceRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string, isFinal?: boolean) => void;
  onTranscript?: (text: string) => void;
  onError?: (err: any) => void;
  onEnd?: () => void;
}

/**
 * Démarre l'écoute vocale de l'utilisateur (Speech-to-Text en français).
 */
export function startVoiceRecognition(
  optionsOrTranscript: VoiceRecognitionOptions | ((text: string) => void),
  onError?: (err: any) => void,
  onEnd?: () => void
): () => void {
  const options: VoiceRecognitionOptions =
    typeof optionsOrTranscript === "function"
      ? { onTranscript: optionsOrTranscript, onError, onEnd }
      : optionsOrTranscript;

  const onResult = options.onResult || options.onTranscript || (() => {});
  const handleError = options.onError || onError;
  const handleEnd = options.onEnd || onEnd;

  if (!isSpeechRecognitionSupported()) {
    if (handleError)
      handleError(new Error("La reconnaissance vocale n'est pas supportée par ce navigateur."));
    return () => {};
  }

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRec();

  recognition.lang = options.lang || "fr-FR";
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;

  recognition.onresult = (event: any) => {
    let transcript = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    if (transcript.trim()) {
      onResult(transcript, isFinal);
    }
  };

  recognition.onerror = (event: any) => {
    if (handleError) handleError(event);
  };

  recognition.onend = () => {
    activeRecognition = null;
    if (handleEnd) handleEnd();
  };

  activeRecognition = recognition;
  recognition.start();

  return () => {
    try {
      recognition.stop();
    } catch {
      // Ignorer si déjà arrêté
    }
    activeRecognition = null;
  };
}

export function stopVoiceRecognition() {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {
      // ignore
    }
    activeRecognition = null;
  }
}

export interface SpeakTextOptions {
  lang?: string;
  rate?: number;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Lecture vocale d'une réponse de l'IA (Text-to-Speech en français).
 */
export function speakText(
  text: string,
  optionsOrOnEnd?: SpeakTextOptions | (() => void)
) {
  if (!isSpeechSynthesisSupported()) return;

  const options: SpeakTextOptions =
    typeof optionsOrOnEnd === "function" ? { onEnd: optionsOrOnEnd } : optionsOrOnEnd || {};

  window.speechSynthesis.cancel();

  // Nettoyage des balises Markdown et caractères spéciaux pour une élocution fluide
  const clean = text
    .replace(/[*_#`~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/•/g, "")
    .slice(0, 800); // Limite raisonnable pour éviter une lecture interminable

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = options.lang || "fr-FR";
  utterance.rate = options.rate ?? 1.05; // Rythme naturel dynamique

  // Sélection de voix française si disponible
  const voices = window.speechSynthesis.getVoices();
  const frVoice = voices.find((v) => v.lang.startsWith("fr") || v.lang.startsWith("FR"));
  if (frVoice) {
    utterance.voice = frVoice;
  }

  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }
  if (options.onError) {
    utterance.onerror = options.onError;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
