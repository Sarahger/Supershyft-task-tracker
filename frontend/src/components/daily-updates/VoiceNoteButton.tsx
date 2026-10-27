import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import clsx from 'clsx';
import { toast } from '../ui/Toast';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface Props {
  disabled?: boolean;
  /** Called with each finalized English transcript chunk (append yourself). */
  onTranscript: (text: string) => void;
}

/** Browser speech-to-text (English). Multiple sessions append via onTranscript. */
export function VoiceNoteButton({ disabled, onTranscript }: Props) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const start = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error('Voice notes need Chrome, Edge, or Safari.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) chunk += result[0].transcript;
      }
      const text = chunk.trim();
      if (text) onTranscriptRef.current(text);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error('Could not transcribe — edit the text manually.');
      }
      stop();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      toast.error('Microphone unavailable.');
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (listening ? stop() : start())}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium min-h-[36px]',
        'transition-colors duration-hover disabled:opacity-50',
        listening
          ? 'border-red-500/40 bg-red-500/10 text-red-400'
          : 'border-dark-border bg-surface-subtle text-text-secondary hover:bg-dark-hover hover:text-text-primary',
      )}
      aria-pressed={listening}
      title={listening ? 'Stop recording' : 'Record voice note (English)'}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      {listening ? 'Stop' : 'Voice note'}
    </button>
  );
}

/** Append a transcript chunk to existing note text. */
export function appendVoiceTranscript(current: string, chunk: string): string {
  const next = chunk.trim();
  if (!next) return current;
  const base = current.trimEnd();
  if (!base) return next;
  const needsSpace = !/[\s\n]$/.test(base);
  return `${base}${needsSpace ? ' ' : ''}${next}`;
}
