//! Dev-only: Firebase redirect sign-in fails in Tauri’s WKWebView; Safari completes it reliably.
//! A short-lived `127.0.0.1` listener receives the credential from the browser tab and emits the
//! same events as `OAuthBridge` in a webview.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;

const BRIDGE_PATH: &str = "/chinotto-oauth-bridge";
const HEADER_SECRET: &str = "x-chinotto-oauth-secret";
const MAX_BODY: usize = 256 * 1024;
const LISTEN_TIMEOUT: Duration = Duration::from_secs(4 * 60);

#[derive(serde::Deserialize)]
struct BridgeBody {
    nonce: String,
    credential: serde_json::Value,
}

fn cors_preflight_response() -> &'static str {
    "HTTP/1.1 204 No Content\r\n\
     Access-Control-Allow-Origin: *\r\n\
     Access-Control-Allow-Methods: POST, OPTIONS\r\n\
     Access-Control-Allow-Headers: Content-Type, X-Chinotto-OAuth-Secret\r\n\
     Access-Control-Max-Age: 3600\r\n\
     Connection: close\r\n\r\n"
}

fn respond_json(
    stream: &mut TcpStream,
    code: u16,
    reason: &str,
    body: &str,
) -> Result<(), std::io::Error> {
    let text = format!(
        "HTTP/1.1 {code} {reason}\r\n\
         Content-Type: application/json; charset=utf-8\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n\
         {body}",
        body.len()
    );
    stream.write_all(text.as_bytes())
}

fn read_request(stream: &mut TcpStream) -> Result<(String, String, Vec<u8>), String> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| e.to_string())?;
    let request_line = request_line.trim().to_string();

    let mut content_length = 0usize;
    let mut secret_header: Option<String> = None;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;
        if line == "\r\n" || line == "\n" || line.is_empty() {
            break;
        }
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("content-length:") {
            content_length = line
                .split(':')
                .nth(1)
                .ok_or_else(|| "bad Content-Length".to_string())?
                .trim()
                .parse::<usize>()
                .map_err(|_| "bad Content-Length value".to_string())?;
        } else if lower.starts_with(HEADER_SECRET) {
            secret_header = line
                .split(':')
                .nth(1)
                .map(|s| s.trim().to_string());
        }
    }

    if content_length > MAX_BODY {
        return Err("body too large".to_string());
    }

    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).map_err(|e| e.to_string())?;

    Ok((
        request_line,
        secret_header.unwrap_or_default(),
        body,
    ))
}

fn handle_connection(
    mut stream: TcpStream,
    expected_secret: &str,
    app: &tauri::AppHandle,
) -> Result<bool, String> {
    let (request_line, header_secret, body) = read_request(&mut stream)?;

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        return Ok(false);
    }
    let method = parts[0];
    let path = parts[1].split('?').next().unwrap_or(parts[1]);

    if method == "OPTIONS" && path == BRIDGE_PATH {
        let _ = stream.write_all(cors_preflight_response().as_bytes());
        return Ok(false);
    }

    if method != "POST" || path != BRIDGE_PATH {
        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        return Ok(false);
    }

    if header_secret != expected_secret {
        let msg = r#"{"ok":false,"error":"unauthorized"}"#;
        let _ = respond_json(&mut stream, 401, "Unauthorized", msg);
        return Ok(false);
    }

    let parsed: BridgeBody =
        serde_json::from_slice(&body).map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "nonce": parsed.nonce,
        "credential": parsed.credential,
    });

    app.emit("chinotto-sync-oauth-success", payload)
        .map_err(|e| e.to_string())?;

    let ok = r#"{"ok":true}"#;
    let _ = respond_json(&mut stream, 200, "OK", ok);
    Ok(true)
}

/// Binds `127.0.0.1:0`. The browser POSTs `{ nonce, credential }` with header `X-Chinotto-OAuth-Secret`.
#[tauri::command]
pub fn start_oauth_dev_bridge_listener(
    app: tauri::AppHandle,
    secret: String,
) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener
        .set_nonblocking(true)
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let app = Arc::new(app);
    let secret = Arc::new(secret);
    std::thread::spawn(move || {
        let deadline = Instant::now() + LISTEN_TIMEOUT;
        let mut done = false;
        while Instant::now() < deadline && !done {
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));
                    match handle_connection(stream, secret.as_str(), app.as_ref()) {
                        Ok(true) => done = true,
                        Ok(false) => {}
                        Err(e) => {
                            log::warn!("[oauth_dev_bridge] request error: {e}");
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(80));
                }
                Err(e) => {
                    log::warn!("[oauth_dev_bridge] accept: {e}");
                    break;
                }
            }
        }
    });

    Ok(port)
}
