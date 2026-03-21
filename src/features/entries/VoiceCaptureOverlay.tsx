import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Input } from "@/components/ui/input";
import { ENTER_KEY_GLYPH } from "@/lib/keyboardLabels";

const SILENCE_MS = 2000;
const MAX_RECORDING_MS = 10000;
const SAFETY_FINALIZE_MS = 1500;

export type VoiceCaptureMode = "shortcut" | "hold";

type Props = {
  mode: VoiceCaptureMode;
  releasedBeforeMountRef?: React.MutableRefObject<boolean> | null;
  onClose: () => void;
  onCreateEntry: (text: string) => void | Promise<void>;
};

export function VoiceCaptureOverlay({
  mode,
  releasedBeforeMountRef,
  onClose,
  onCreateEntry,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [tryNativeFirst, setTryNativeFirst] = useState(mode === "shortcut");
  const [speechState, setSpeechState] = useState<"preparing" | "listening" | "processing" | "voice_captured">("preparing");
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const finalizedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortedRef = useRef(false);
  const transcriptAccumulatorRef = useRef<{
    transcripts: string[];
    lastInterim: string;
  }>({ transcripts: [], lastInterim: "" });

  const finalize = useCallback(
    (text: string | null) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      if (text && text.trim()) {
        onCreateEntry(text.trim());
      } else {
        setError("Couldn't recognize speech");
      }
    },
    [onCreateEntry]
  );

  useEffect(() => {
    abortedRef.current = false;
    if (mode === "hold" && releasedBeforeMountRef?.current) {
      releasedBeforeMountRef.current = false;
      finalize(null);
      return;
    }

    if (mode === "shortcut" && tryNativeFirst) {
      let cancelled = false;
      setSpeechState("preparing");
      const unlistenPromise = listen<"listening" | "processing" | "voice_captured">(
        "chinotto-speech-state",
        (event) => {
          if (cancelled) return;
          const s = event.payload;
          if (s === "listening" || s === "processing" || s === "voice_captured") {
            setSpeechState(s);
          }
        }
      );
      invoke<string | null>("run_native_speech_recognition", {
        maxMs: MAX_RECORDING_MS,
      })
        .then((result) => {
          if (cancelled) return;
          if (result?.trim()) finalize(result.trim());
          else finalize(null);
        })
        .catch((err) => {
          if (cancelled) return;
          const msg = String(err);
          if (msg.includes("only available on macOS")) {
            setTryNativeFirst(false);
          } else {
            // Show the actual error message from the backend
            setError(msg);
            finalizedRef.current = true;
          }
        });
      return () => {
        cancelled = true;
        unlistenPromise.then((u) => u());
      };
    }

    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Couldn't recognize speech");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    if (mode === "hold") recognitionRef.current = recognition;

    transcriptAccumulatorRef.current = { transcripts: [], lastInterim: "" };
    let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearSilenceTimer = () => {
      if (silenceTimeout !== null) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
      }
    };

    const runSafetyFinalize = () => {
      if (safetyTimeout !== null) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      if (finalizedRef.current) return;
      const acc = transcriptAccumulatorRef.current;
      if (acc.lastInterim.trim()) acc.transcripts.push(acc.lastInterim.trim());
      const text = acc.transcripts.join(" ").trim();
      finalize(text || null);
    };

    const scheduleSafetyFinalizeOnce = () => {
      if (safetyTimeout !== null) return;
      safetyTimeout = setTimeout(runSafetyFinalize, SAFETY_FINALIZE_MS);
    };

    const stopAndScheduleSafety = () => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      scheduleSafetyFinalizeOnce();
    };

    const scheduleSilenceStop = () => {
      if (mode !== "shortcut") return;
      clearSilenceTimer();
      silenceTimeout = setTimeout(stopAndScheduleSafety, SILENCE_MS);
    };

    const maxTimeout =
      mode === "shortcut"
        ? setTimeout(stopAndScheduleSafety, MAX_RECORDING_MS)
        : null;

    if (mode === "shortcut") scheduleSilenceStop();

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const acc = transcriptAccumulatorRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        let transcript = "";
        if (result.length > 0) {
          const first = result[0];
          transcript =
            typeof first.transcript === "string" ? first.transcript : "";
        }
        if (result.isFinal) {
          if (transcript.trim()) acc.transcripts.push(transcript.trim());
          acc.lastInterim = "";
        } else {
          acc.lastInterim = transcript;
        }
      }
      scheduleSilenceStop();
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "aborted") return;
      clearSilenceTimer();
    };

    recognition.onend = () => {
      if (mode === "hold") recognitionRef.current = null;
      clearSilenceTimer();
      if (maxTimeout !== null) clearTimeout(maxTimeout);
      if (safetyTimeout !== null) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      const wasAborted = abortedRef.current;
      const done = () => {
        if (wasAborted) return;
        runSafetyFinalize();
      };
      setTimeout(done, 100);
    };

    try {
      recognition.start();
    } catch {
      finalize(null);
    }

    return () => {
      abortedRef.current = true;
      clearSilenceTimer();
      if (maxTimeout !== null) clearTimeout(maxTimeout);
      if (safetyTimeout !== null) clearTimeout(safetyTimeout);
      if (mode === "hold") recognitionRef.current = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [finalize, mode, releasedBeforeMountRef, tryNativeFirst]);

  useEffect(() => {
    if (mode !== "hold") return;
    const stopRecording = () => {
      const r = recognitionRef.current;
      if (r) {
        try {
          r.stop();
        } catch {
          /* ignore */
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Alt" && e.key !== "Option") return;
      stopRecording();
    };
    const unlistenPromise = listen("chinotto-voice-hold-stop", stopRecording);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      unlistenPromise.then((u) => u());
    };
  }, [mode]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (error) {
      fallbackInputRef.current?.focus();
    } else if (mode === "shortcut") {
      const t = setTimeout(() => fallbackInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [error, mode]);

  const handleFallbackSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = fallbackInputRef.current?.value.trim();
      if (text) {
        onCreateEntry(text);
      } else {
        onClose();
      }
    },
    [onCreateEntry, onClose]
  );

  return (
    <div
      className="voice-capture-overlay"
      role="dialog"
      aria-label="Voice capture"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="voice-capture-center">
        <p className="voice-capture-prompt">
          {mode === "hold"
            ? "● Listening… Release to save thought"
            : tryNativeFirst
              ? speechState === "preparing"
                ? "Preparing…"
                : speechState === "listening"
                  ? "Listening…"
                  : speechState === "processing"
                    ? "Processing…"
                    : speechState === "voice_captured"
                      ? "Voice captured"
                      : "🎙 Speak your thought…"
              : "🎙 Speak your thought…"}
        </p>
        {error && <p className="voice-capture-error">{error}</p>}
        {(error || mode === "shortcut") && (
          <form
            className="voice-capture-fallback"
            onSubmit={handleFallbackSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              ref={fallbackInputRef}
              type="text"
              placeholder={
                mode === "shortcut"
                  ? `Or type here, ${ENTER_KEY_GLYPH} to save`
                  : `Type your thought, ${ENTER_KEY_GLYPH} to save`
              }
              className="voice-capture-fallback-input"
              aria-label="Type thought"
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
            />
          </form>
        )}
      </div>
    </div>
  );
}
