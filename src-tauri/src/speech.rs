//! Native macOS speech recognition via Speech framework.
//! Long-lived SpeechManager plus warm-up to reduce startup latency.

#![cfg(target_os = "macos")]

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::AnyThread;
use objc2_avf_audio::{AVAudioEngine, AVAudioFrameCount, AVAudioPCMBuffer, AVAudioTime};
use objc2_foundation::NSError;
use objc2_speech::{
    SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionResult, SFSpeechRecognizer,
};
use std::ptr::NonNull;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const AUTHORIZED_STATUS: isize = 3;

/// Long-lived speech pipeline: authorization and recognizer created once.
pub struct SpeechManager {
    recognizer: Mutex<Option<Retained<SFSpeechRecognizer>>>,
}

impl SpeechManager {
    pub fn new() -> Self {
        Self {
            recognizer: Mutex::new(None),
        }
    }

    /// Ensure authorization and recognizer are ready. Call at app startup and/or before first capture.
    pub fn warm_up(&self) -> Result<(), String> {
        let guard = self.recognizer.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            eprintln!("[Speech] Warm-up: already ready");
            return Ok(());
        }
        drop(guard);

        let t0 = Instant::now();

        // Check current authorization status first
        let current_status = unsafe { SFSpeechRecognizer::authorizationStatus() };
        eprintln!(
            "[Speech] {} ms - warm-up: current authorization status {}",
            t0.elapsed().as_millis(),
            current_status.0
        );

        let status: isize = if current_status.0 == AUTHORIZED_STATUS {
            eprintln!(
                "[Speech] {} ms - warm-up: already authorized",
                t0.elapsed().as_millis()
            );
            AUTHORIZED_STATUS
        } else if current_status.0 == 0 {
            // Status 0 = not determined, need to request authorization
            // However, requestAuthorization callback requires the main thread's run loop.
            // From a background thread, the callback never fires.
            // Instead of hanging, return an error with instructions.
            eprintln!(
                "[Speech] {} ms - warm-up: authorization not determined, needs user action",
                t0.elapsed().as_millis()
            );
            return Err("Speech recognition permission is required. \n\n\
                Please go to:\n\
                System Settings > Privacy & Security > Speech Recognition\n\n\
                Enable access for Chinotto, then try again."
                .to_string());
        } else {
            // Already denied (2) or restricted (1)
            current_status.0
        };

        if status != AUTHORIZED_STATUS {
            return Err(format!(
                "Speech recognition not authorized (status: {}).\n\n\
                Please go to:\n\
                System Settings > Privacy & Security > Speech Recognition\n\n\
                Enable access for Chinotto, then try again.",
                status
            ));
        }

        eprintln!(
            "[Speech] {} ms - warm-up: creating recognizer",
            t0.elapsed().as_millis()
        );
        let recognizer = unsafe {
            SFSpeechRecognizer::init(SFSpeechRecognizer::alloc())
                .ok_or("Could not create speech recognizer")?
        };
        let available = unsafe { recognizer.isAvailable() };
        eprintln!(
            "[Speech] {} ms - warm-up: recognizer available {}",
            t0.elapsed().as_millis(),
            available
        );
        if !available {
            return Err("Speech recognition is not available".to_string());
        }

        let mut guard = self.recognizer.lock().map_err(|e| e.to_string())?;
        *guard = Some(recognizer);
        eprintln!(
            "[Speech] {} ms - speech manager ready (warm-up done)",
            t0.elapsed().as_millis()
        );
        Ok(())
    }

    fn ensure_recognizer(&self) -> Result<Retained<SFSpeechRecognizer>, String> {
        let guard = self.recognizer.lock().map_err(|e| e.to_string())?;
        if let Some(r) = guard.as_ref() {
            return Ok(r.clone());
        }
        drop(guard);
        self.warm_up()?;
        let guard = self.recognizer.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| "Recognizer missing after warm-up".to_string())
    }

    /// Run one capture: record up to `max_ms`, return final or best partial transcript.
    /// `event_tx`: send "listening" | "processing" | "voice_captured" for UX.
    pub fn run_capture(
        &self,
        max_ms: u64,
        event_tx: Option<mpsc::SyncSender<&'static str>>,
    ) -> Result<Option<String>, String> {
        let t0 = Instant::now();
        eprintln!("[Speech] {} ms - capture started", t0.elapsed().as_millis());

        let recognizer = self.ensure_recognizer()?;
        eprintln!(
            "[Speech] {} ms - speech manager ready",
            t0.elapsed().as_millis()
        );

        let request = unsafe {
            SFSpeechAudioBufferRecognitionRequest::init(
                SFSpeechAudioBufferRecognitionRequest::alloc(),
            )
        };
        unsafe {
            request.setShouldReportPartialResults(true);
        }
        let supports_on_device = unsafe { recognizer.supportsOnDeviceRecognition() };
        if supports_on_device {
            unsafe {
                request.setRequiresOnDeviceRecognition(true);
            }
            eprintln!(
                "[Speech] {} ms - on-device recognition enabled",
                t0.elapsed().as_millis()
            );
        }

        eprintln!(
            "[Speech] {} ms - setting up audio engine",
            t0.elapsed().as_millis()
        );
        let engine = unsafe { AVAudioEngine::new() };
        let input_node = unsafe { engine.inputNode() };
        let format = unsafe { input_node.outputFormatForBus(0) };

        let request_for_tap = request.clone();
        let tap_block: RcBlock<dyn Fn(NonNull<AVAudioPCMBuffer>, NonNull<AVAudioTime>) + 'static> =
            RcBlock::new(
                move |buffer: NonNull<AVAudioPCMBuffer>, _when: NonNull<AVAudioTime>| unsafe {
                    request_for_tap.appendAudioPCMBuffer(buffer.as_ref());
                },
            );

        const BUS: objc2_avf_audio::AVAudioNodeBus = 0;
        const BUFFER_SIZE: AVAudioFrameCount = 8192;
        let tap_block_ptr: *const _ = &*tap_block;
        unsafe {
            input_node.installTapOnBus_bufferSize_format_block(
                BUS,
                BUFFER_SIZE,
                Some(&format),
                tap_block_ptr as *mut _,
            );
        }
        let _tap_block_guard = tap_block;

        let (result_tx, result_rx) = mpsc::sync_channel(1);
        let last_transcript = Arc::new(Mutex::new(String::new()));
        let last_transcript_clone = last_transcript.clone();
        let first_partial_sent = Arc::new(Mutex::new(false));
        let start = Arc::new(Mutex::new(t0));
        let event_tx_shared = event_tx.map(|tx| Arc::new(Mutex::new(Some(tx))));
        let event_tx_for_sends = event_tx_shared.as_ref().map(Arc::clone);

        let result_block = RcBlock::new(
            move |result: *mut SFSpeechRecognitionResult, error: *mut NSError| {
                if !error.is_null() {
                    eprintln!("[Speech] Result handler got error");
                    let _ = result_tx.send(Ok(None));
                    return;
                }
                if result.is_null() {
                    return;
                }
                let result = unsafe { &*result };
                let is_final = unsafe { result.isFinal() };
                let transcription = unsafe { result.bestTranscription() };
                let s = unsafe { transcription.formattedString() };
                let text = s.to_string();

                let ms = start.lock().map(|t| t.elapsed().as_millis()).unwrap_or(0);
                if let Ok(mut last) = last_transcript_clone.lock() {
                    *last = text.clone();
                }

                if is_final {
                    eprintln!("[Speech] {} ms - final transcript received: {}", ms, text);
                    if let Some(ref et) = event_tx_shared {
                        if let Ok(guard) = et.lock() {
                            if let Some(ref tx) = *guard {
                                let _ = tx.send("voice_captured");
                            }
                        }
                    }
                    let _ = result_tx.send(Ok(Some(text)));
                } else {
                    if let Ok(mut sent) = first_partial_sent.lock() {
                        if !*sent {
                            *sent = true;
                            eprintln!(
                                "[Speech] {} ms - first partial transcript received: {}",
                                ms, text
                            );
                        }
                    }
                    eprintln!("[Speech] {} ms - partial: {}", ms, text);
                }
            },
        );

        let task =
            unsafe { recognizer.recognitionTaskWithRequest_resultHandler(&request, &result_block) };
        eprintln!(
            "[Speech] {} ms - recognition task started",
            t0.elapsed().as_millis()
        );

        let start_result = unsafe { engine.startAndReturnError() };
        if let Err(err) = start_result {
            unsafe {
                input_node.removeTapOnBus(BUS);
            }
            return Err(format!("Could not start audio engine: {}", err));
        }
        eprintln!(
            "[Speech] {} ms - audio engine started",
            t0.elapsed().as_millis()
        );
        if let Some(ref arc) = event_tx_for_sends {
            if let Ok(guard) = arc.lock() {
                if let Some(ref tx) = *guard {
                    let _ = tx.send("listening");
                }
            }
        }

        eprintln!(
            "[Speech] {} ms - recording for {}ms",
            t0.elapsed().as_millis(),
            max_ms
        );
        std::thread::sleep(Duration::from_millis(max_ms));

        eprintln!("[Speech] {} ms - ending audio", t0.elapsed().as_millis());
        if let Some(ref arc) = event_tx_for_sends {
            if let Ok(guard) = arc.lock() {
                if let Some(ref tx) = *guard {
                    let _ = tx.send("processing");
                }
            }
        }
        unsafe {
            request.endAudio();
        }

        eprintln!(
            "[Speech] {} ms - waiting for final result",
            t0.elapsed().as_millis()
        );
        let outcome = result_rx.recv_timeout(Duration::from_millis(5000));

        unsafe {
            engine.stop();
            std::thread::sleep(Duration::from_millis(100));
            input_node.removeTapOnBus(BUS);
        }
        drop(task);
        drop(_tap_block_guard);

        match outcome {
            Ok(Ok(transcript)) => Ok(transcript),
            Ok(Err(e)) => Err(e),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                eprintln!(
                    "[Speech] {} ms - timed out waiting for final result, using partial",
                    t0.elapsed().as_millis()
                );
                if let Ok(last) = last_transcript.lock() {
                    if !last.is_empty() {
                        Ok(Some(last.clone()))
                    } else {
                        Ok(None)
                    }
                } else {
                    Ok(None)
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => Ok(None),
        }
    }
}

/// Command for the speech thread: (max_ms, result_tx, event_tx for state events).
pub type SpeechCommand = (
    u64,
    mpsc::SyncSender<Result<Option<String>, String>>,
    Option<mpsc::SyncSender<&'static str>>,
);

/// Run the long-lived speech loop: warm up on first use, then handle capture commands.
pub fn run_speech_loop(rx: mpsc::Receiver<SpeechCommand>) {
    let manager = SpeechManager::new();
    eprintln!("[Speech] Speech loop started (warm-up deferred to first use)");
    while let Ok((max_ms, result_tx, event_tx)) = rx.recv() {
        let result = manager.run_capture(max_ms, event_tx);
        let _ = result_tx.send(result);
    }
}
