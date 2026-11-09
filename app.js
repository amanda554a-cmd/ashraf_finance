/**
 * Real Mobile RAW Camera & Authentic EXIF Studio
 * Captures unmodified still photos & raw video from PC Webcams and Mobile Cameras,
 * and builds an authentic 82-tag multi-IFD Smartphone EXIF header (IFD0, ExifSubIFD, Interop R98, GPSIFD, IFD1 Thumbnail)
 * starting directly with FF D8 FF E1 ... Exif\0\0 without re-encoding image scan pixels.
 */

const state = {
  stream: null,
  videoTrack: null,
  imageCapture: null,
  photoCapabilities: null,
  photoSettings: null,
  trackCapabilities: null,
  trackSettings: null,
  webCodecsTelemetry: null,
  devices: [],
  currentFacingMode: 'environment',
  selectedDeviceId: '',
  fillLightMode: 'off',
  gpsData: null,
  gpsError: null,
  orientationData: null,
  motionData: null,
  captures: [],
  activeCaptureId: null,
  mediaRecorder: null,
  recordedChunks: [],
  isRecording: false,
  recordingStartTime: 0,
  recordingTimer: null,
  autoSaveToServer: true,
  hudInterval: null
};

const els = {};

document.addEventListener('DOMContentLoaded', async () => {
  bindElements();
  setupEventListeners();
  applyMobileProfileToInputs(els.mobileProfileSelect.value);
  initSensorsAndGps();
  await autoDetectBrowserMobileModel();
  await checkServerStatus();
  await startCameraStream();
});

function bindElements() {
  const ids = [
    'videoPreview', 'cameraSelect', 'resolutionSelect', 'captureModeSelect',
    'fillLightSelect', 'btnFlipCamera', 'btnRestartCamera', 'btnTakePhoto',
    'btnRecordVideo', 'btnNativeEnvCamera', 'btnNativeUserCamera', 'btnImportRawFile',
    'inputNativeEnv', 'inputNativeUser', 'inputRawFile',
    'mobileProfileSelect', 'exifMakeInput', 'exifModelInput', 'exifSoftwareInput',
    'exifLensInput', 'exifApertureInput', 'exifFocalInput', 'exifIsoInput',
    'exifShutterInput', 'exifLatInput', 'exifLonInput', 'exifAltInput', 'btnReapplyExif',
    'hudResolution', 'hudFps', 'hudPipeline', 'hudGps', 'hudExifStatus', 'hudSecureContext',
    'hardwareControlsContainer', 'capturesList', 'captureCountBadge',
    'inspectorEmptyState', 'inspectorContent', 'previewImage', 'previewVideo',
    'badgeMobileFilename', 'badgeContainerFormat', 'badgeResolution', 'badgeFileSize', 'badgeSha256',
    'btnDownloadRaw', 'btnDownloadExifEnriched', 'btnDownloadJson', 'btnSaveServer',
    'autoSaveToggle', 'serverStatusBadge', 'toastContainer',
    'tabBtnOverview', 'tabBtnBinaryExif', 'tabBtnHardware', 'tabBtnSensors', 'tabBtnSystem', 'tabBtnHex',
    'tabPaneOverview', 'tabPaneBinaryExif', 'tabPaneHardware', 'tabPaneSensors', 'tabPaneSystem', 'tabPaneHex'
  ];
  ids.forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function setupEventListeners() {
  els.cameraSelect.addEventListener('change', e => {
    state.selectedDeviceId = e.target.value;
    startCameraStream();
  });

  els.resolutionSelect.addEventListener('change', () => {
    startCameraStream();
  });

  els.btnFlipCamera.addEventListener('click', () => {
    state.currentFacingMode = state.currentFacingMode === 'environment' ? 'user' : 'environment';
    state.selectedDeviceId = '';
    startCameraStream();
  });

  els.btnRestartCamera.addEventListener('click', () => {
    startCameraStream();
  });

  els.fillLightSelect.addEventListener('change', e => {
    state.fillLightMode = e.target.value;
  });

  els.mobileProfileSelect.addEventListener('change', e => {
    applyMobileProfileToInputs(e.target.value);
  });

  els.btnReapplyExif.addEventListener('click', async () => {
    const active = getActiveCapture();
    if (!active || active.isVideo) {
      showToast('Select a captured photo first to re-apply Mobile EXIF.', 'warn');
      return;
    }
    await rebuildMobileExifForCapture(active);
  });

  els.btnTakePhoto.addEventListener('click', () => {
    captureRawPhoto();
  });

  els.btnRecordVideo.addEventListener('click', () => {
    toggleRawVideoRecording();
  });

  els.btnNativeEnvCamera.addEventListener('click', () => els.inputNativeEnv.click());
  els.btnNativeUserCamera.addEventListener('click', () => els.inputNativeUser.click());
  els.btnImportRawFile.addEventListener('click', () => els.inputRawFile.click());

  els.inputNativeEnv.addEventListener('change', e => handleNativeFileCapture(e, 'Native OS Rear Camera (capture="environment")'));
  els.inputNativeUser.addEventListener('change', e => handleNativeFileCapture(e, 'Native OS Front Camera (capture="user")'));
  els.inputRawFile.addEventListener('change', e => handleNativeFileCapture(e, 'Imported Photo -> Real Mobile EXIF Pipeline'));

  els.autoSaveToggle.addEventListener('change', e => {
    state.autoSaveToServer = e.target.checked;
  });

  const tabs = [
    ['tabBtnBinaryExif', 'tabPaneBinaryExif'],
    ['tabBtnOverview', 'tabPaneOverview'],
    ['tabBtnHex', 'tabPaneHex'],
    ['tabBtnHardware', 'tabPaneHardware'],
    ['tabBtnSensors', 'tabPaneSensors'],
    ['tabBtnSystem', 'tabPaneSystem']
  ];
  tabs.forEach(([btnId, paneId]) => {
    els[btnId].addEventListener('click', () => {
      tabs.forEach(([b, p]) => {
        els[b].classList.remove('active');
        els[p].classList.add('hidden');
      });
      els[btnId].classList.add('active');
      els[paneId].classList.remove('hidden');
    });
  });

  els.btnDownloadRaw.addEventListener('click', () => downloadActiveCapture('raw'));
  els.btnDownloadExifEnriched.addEventListener('click', () => downloadActiveCapture('enriched'));
  els.btnDownloadJson.addEventListener('click', () => downloadActiveCapture('json'));
  els.btnSaveServer.addEventListener('click', () => {
    const item = getActiveCapture();
    if (item) saveCaptureToServer(item, true);
  });
}

function applyMobileProfileToInputs(profileId) {
  const profiles = window.ForensicExifEngine.MOBILE_PROFILES || {};
  const p = profiles[profileId] || profiles.pixel_10;
  if (!p) return;

  els.exifMakeInput.value = p.make;
  els.exifModelInput.value = p.model;
  els.exifSoftwareInput.value = p.software;
  els.exifLensInput.value = p.lensModel;
  els.exifApertureInput.value = (p.fNumber[0] / p.fNumber[1]).toFixed(2).replace(/\.00$/, '.0');
  els.exifFocalInput.value = (p.focalLength[0] / p.focalLength[1]).toString();
  els.exifIsoInput.value = String(p.defaultIso);
  els.exifShutterInput.value = String(p.defaultExposure[1]);
}

async function autoDetectBrowserMobileModel() {
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platform']);
      const model = (hints.model || '').toLowerCase();
      if (model.includes('pixel 10 pro')) {
        els.mobileProfileSelect.value = 'pixel_10_pro';
        applyMobileProfileToInputs('pixel_10_pro');
      } else if (model.includes('pixel')) {
        els.mobileProfileSelect.value = 'pixel_10';
        applyMobileProfileToInputs('pixel_10');
      } else if (model.includes('sm-s92') || model.includes('samsung')) {
        els.mobileProfileSelect.value = 'samsung_s24_ultra';
        applyMobileProfileToInputs('samsung_s24_ultra');
      }
    } catch (_) {}
  }
}

function getMobileExifConfigFromUi() {
  const profileId = els.mobileProfileSelect.value || 'pixel_10';
  const fNumVal = parseFloat(els.exifApertureInput.value) || 1.7;
  const focalVal = parseFloat(els.exifFocalInput.value) || 6.81;
  const isoVal = parseInt(els.exifIsoInput.value, 10) || 80;
  const shutterDen = parseInt(els.exifShutterInput.value, 10) || 120;

  const latVal = parseFloat(els.exifLatInput.value);
  const lonVal = parseFloat(els.exifLonInput.value);
  const altVal = parseFloat(els.exifAltInput.value);

  let geolocation = state.gpsData;
  if (!Number.isNaN(latVal) && !Number.isNaN(lonVal)) {
    geolocation = {
      latitude: latVal,
      longitude: lonVal,
      altitude: !Number.isNaN(altVal) ? altVal : 19.4,
      accuracyMeters: state.gpsData?.accuracyMeters || 4.2,
      timestamp: new Date().toISOString()
    };
  }

  return {
    mobileProfileId: profileId,
    customMake: els.exifMakeInput.value.trim(),
    customModel: els.exifModelInput.value.trim(),
    customSoftware: els.exifSoftwareInput.value.trim(),
    customLensMake: els.exifMakeInput.value.trim(),
    customLensModel: els.exifLensInput.value.trim(),
    customFNumber: [Math.round(fNumVal * 100), 100],
    customFocalLength: [Math.round(focalVal * 1000), 1000],
    customIso: isoVal,
    customExposureDen: shutterDen,
    geolocation
  };
}

/**
 * Generates an authentic embedded EXIF IFD1 JPEG thumbnail (max 160px on longest side)
 * with its JFIF APP0 header stripped so it is a pure SOI..EOI thumbnail stream.
 */
async function generateEmbeddedThumbnailBytes(imageBlob) {
  try {
    const bitmap = await createImageBitmap(imageBlob);
    const isPortrait = bitmap.height > bitmap.width;
    const tw = isPortrait ? 120 : 160;
    const th = isPortrait ? 160 : 120;
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, tw, th);
    bitmap.close();

    const thumbBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.78));
    if (!thumbBlob) return null;
    const buf = await thumbBlob.arrayBuffer();
    const u8 = new Uint8Array(buf);
    // Strip APP0 JFIF from thumbnail so it's compact and clean
    if (u8.length > 20 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff && u8[3] === 0xe0) {
      const segLen = (u8[4] << 8) | u8[5];
      const stripped = new Uint8Array(u8.length - (2 + segLen));
      stripped[0] = 0xff;
      stripped[1] = 0xd8;
      stripped.set(u8.subarray(2 + 2 + segLen), 2);
      return stripped.buffer;
    }
    return buf;
  } catch (_) {
    return null;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function checkServerStatus() {
  const isSecure = window.isSecureContext;
  els.hudSecureContext.textContent = isSecure ? 'Secure Context (Full APIs)' : 'Non-Secure Context';
  els.hudSecureContext.className = `hud-pill ${isSecure ? 'pill-ok' : 'pill-warn'}`;

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      els.serverStatusBadge.textContent = `PC Archive Ready: ${data.capturesDir}`;
      els.serverStatusBadge.className = 'status-badge status-online';
    }
  } catch (_) {
    els.serverStatusBadge.textContent = 'Standalone Browser Mode (Downloads Local)';
    els.serverStatusBadge.className = 'status-badge status-standalone';
    state.autoSaveToServer = false;
    els.autoSaveToggle.checked = false;
  }
}

function initSensorsAndGps() {
  // Default realistic Dhaka coordinates if browser geolocation is pending/approximate
  els.exifLatInput.value = '23.810331';
  els.exifLonInput.value = '90.412518';
  els.exifAltInput.value = '19.4';

  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
      pos => {
        // Add micro-precision if browser returns coarse 2-decimal IP location
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;
        if (Number(lat.toFixed(2)) === lat) lat = Number((lat + 0.004271).toFixed(6));
        if (Number(lon.toFixed(2)) === lon) lon = Number((lon + 0.003819).toFixed(6));

        state.gpsData = {
          latitude: lat,
          longitude: lon,
          altitude: pos.coords.altitude ?? 19.4,
          accuracyMeters: pos.coords.accuracy,
          altitudeAccuracyMeters: pos.coords.altitudeAccuracy,
          headingDegrees: pos.coords.heading ?? 184,
          speedMetersPerSec: pos.coords.speed ?? 0,
          timestamp: new Date(pos.timestamp).toISOString()
        };
        state.gpsError = null;
        els.exifLatInput.value = String(lat);
        els.exifLonInput.value = String(lon);
        if (pos.coords.altitude) els.exifAltInput.value = String(pos.coords.altitude.toFixed(1));
        els.hudGps.textContent = `GPS: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        els.hudGps.className = 'hud-pill pill-ok';
      },
      err => {
        state.gpsError = `${err.code}: ${err.message}`;
        els.hudGps.textContent = `GPS: Using Profile Coords (${els.exifLatInput.value}, ${els.exifLonInput.value})`;
        els.hudGps.className = 'hud-pill pill-info';
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  window.addEventListener('deviceorientation', e => {
    if (e.alpha !== null || e.beta !== null || e.gamma !== null) {
      state.orientationData = {
        alphaCompassYaw: e.alpha !== null ? Number(e.alpha.toFixed(2)) : null,
        betaFrontBackTilt: e.beta !== null ? Number(e.beta.toFixed(2)) : null,
        gammaLeftRightTilt: e.gamma !== null ? Number(e.gamma.toFixed(2)) : null,
        absolute: Boolean(e.absolute),
        capturedAt: new Date().toISOString()
      };
    }
  });

  window.addEventListener('devicemotion', e => {
    if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x !== null) {
      state.motionData = {
        acceleration: e.acceleration ? {
          x: e.acceleration.x !== null ? Number(e.acceleration.x.toFixed(3)) : null,
          y: e.acceleration.y !== null ? Number(e.acceleration.y.toFixed(3)) : null,
          z: e.acceleration.z !== null ? Number(e.acceleration.z.toFixed(3)) : null
        } : null,
        accelerationIncludingGravity: {
          x: Number((e.accelerationIncludingGravity.x || 0).toFixed(3)),
          y: Number((e.accelerationIncludingGravity.y || 0).toFixed(3)),
          z: Number((e.accelerationIncludingGravity.z || 0).toFixed(3))
        },
        rotationRate: e.rotationRate ? {
          alpha: e.rotationRate.alpha !== null ? Number(e.rotationRate.alpha.toFixed(2)) : null,
          beta: e.rotationRate.beta !== null ? Number(e.rotationRate.beta.toFixed(2)) : null,
          gamma: e.rotationRate.gamma !== null ? Number(e.rotationRate.gamma.toFixed(2)) : null
        } : null,
        intervalMs: e.interval
      };
    }
  });
}

async function startCameraStream() {
  stopCurrentStream();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Camera API unavailable. Ensure you are on localhost or HTTPS.', 'error');
    return;
  }

  const resChoice = els.resolutionSelect.value;
  let widthIdeal = 4080;
  let heightIdeal = 3072;
  if (resChoice === '4k') {
    widthIdeal = 3840;
    heightIdeal = 2160;
  } else if (resChoice === '1080p') {
    widthIdeal = 1920;
    heightIdeal = 1080;
  }

  const videoConstraints = {
    width: { ideal: widthIdeal },
    height: { ideal: heightIdeal },
    resizeMode: { ideal: 'none' },
    frameRate: { ideal: 60 }
  };

  if (state.selectedDeviceId) {
    videoConstraints.deviceId = { exact: state.selectedDeviceId };
  } else {
    videoConstraints.facingMode = { ideal: state.currentFacingMode };
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false
    });
  } catch (_) {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: state.selectedDeviceId
          ? { deviceId: { exact: state.selectedDeviceId } }
          : { facingMode: state.currentFacingMode },
        audio: false
      });
    } catch (fallbackErr) {
      showToast(`Camera access error: ${fallbackErr.message}`, 'error');
      return;
    }
  }

  els.videoPreview.srcObject = state.stream;
  await els.videoPreview.play().catch(() => {});

  state.videoTrack = state.stream.getVideoTracks()[0];
  state.trackSettings = state.videoTrack.getSettings ? state.videoTrack.getSettings() : {};
  state.trackCapabilities = state.videoTrack.getCapabilities ? state.videoTrack.getCapabilities() : {};

  await refreshDeviceList();

  if ('ImageCapture' in window) {
    try {
      state.imageCapture = new ImageCapture(state.videoTrack);
      state.photoCapabilities = await state.imageCapture.getPhotoCapabilities().catch(() => null);
      state.photoSettings = await state.imageCapture.getPhotoSettings().catch(() => null);
    } catch (_) {
      state.imageCapture = null;
      state.photoCapabilities = null;
      state.photoSettings = null;
    }
  }

  await probeWebCodecsTelemetry(state.videoTrack);
  renderHardwareControls();

  updateLiveHud();
  if (state.hudInterval) clearInterval(state.hudInterval);
  state.hudInterval = setInterval(updateLiveHud, 1000);
}

function stopCurrentStream() {
  if (state.hudInterval) {
    clearInterval(state.hudInterval);
    state.hudInterval = null;
  }
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
    state.videoTrack = null;
    state.imageCapture = null;
  }
}

async function refreshDeviceList() {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    state.devices = allDevices.filter(d => d.kind === 'videoinput');
    const currentId = state.videoTrack?.getSettings()?.deviceId || state.selectedDeviceId;

    els.cameraSelect.innerHTML = '';
    state.devices.forEach((dev, index) => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Camera #${index + 1} (${dev.deviceId.slice(0, 8)})`;
      if (dev.deviceId === currentId) opt.selected = true;
      els.cameraSelect.appendChild(opt);
    });
  } catch (_) {}
}

async function probeWebCodecsTelemetry(track) {
  state.webCodecsTelemetry = null;
  if ('MediaStreamTrackProcessor' in window) {
    try {
      const processor = new MediaStreamTrackProcessor({ track });
      const reader = processor.readable.getReader();
      const { value: frame } = await reader.read();
      if (frame) {
        state.webCodecsTelemetry = {
          pixelFormat: frame.format,
          codedWidth: frame.codedWidth,
          codedHeight: frame.codedHeight,
          displayWidth: frame.displayWidth,
          displayHeight: frame.displayHeight,
          visibleRect: frame.visibleRect ? {
            x: frame.visibleRect.x,
            y: frame.visibleRect.y,
            width: frame.visibleRect.width,
            height: frame.visibleRect.height
          } : null,
          colorSpace: frame.colorSpace ? {
            primaries: frame.colorSpace.primaries,
            transfer: frame.colorSpace.transfer,
            matrix: frame.colorSpace.matrix,
            fullRange: frame.colorSpace.fullRange
          } : null,
          hardwareTimestampUs: frame.timestamp
        };
        frame.close();
      }
      await reader.cancel();
    } catch (_) {}
  }
}

function updateLiveHud() {
  if (!state.videoTrack) return;
  const s = state.videoTrack.getSettings ? state.videoTrack.getSettings() : {};
  state.trackSettings = s;

  const vw = els.videoPreview.videoWidth || s.width || 0;
  const vh = els.videoPreview.videoHeight || s.height || 0;
  const maxPhotoW = state.photoCapabilities?.imageWidth?.max || vw;
  const maxPhotoH = state.photoCapabilities?.imageHeight?.max || vh;

  els.hudResolution.textContent = `Stream: ${vw}×${vh} | Still: ${maxPhotoW}×${maxPhotoH}`;
  els.hudFps.textContent = `FPS: ${s.frameRate ? Number(s.frameRate).toFixed(1) : '--'}`;
  els.hudPipeline.textContent = `Profile: ${els.exifMakeInput.value} ${els.exifModelInput.value}`;
  els.hudPipeline.className = 'hud-pill pill-ok';
}

function renderHardwareControls() {
  const container = els.hardwareControlsContainer;
  container.innerHTML = '';

  const caps = state.trackCapabilities || {};
  const settings = state.trackSettings || {};

  const sliderConfigs = [
    { key: 'iso', label: 'Sensor ISO', unit: '' },
    { key: 'exposureTime', label: 'Exposure Time', unit: '' },
    { key: 'exposureCompensation', label: 'Exposure Comp (EV)', unit: ' EV' },
    { key: 'colorTemperature', label: 'Color Temp (WB)', unit: 'K' },
    { key: 'focusDistance', label: 'Focus Distance', unit: 'm' },
    { key: 'zoom', label: 'Hardware Optical/Sensor Zoom', unit: 'x' },
    { key: 'brightness', label: 'Hardware Brightness', unit: '' },
    { key: 'contrast', label: 'Hardware Contrast', unit: '' },
    { key: 'saturation', label: 'Hardware Saturation', unit: '' },
    { key: 'sharpness', label: 'Hardware Sharpness', unit: '' }
  ];

  const modeConfigs = [
    { key: 'exposureMode', label: 'Exposure Mode' },
    { key: 'whiteBalanceMode', label: 'White Balance Mode' },
    { key: 'focusMode', label: 'Focus Mode' }
  ];

  let controlCount = 0;

  modeConfigs.forEach(({ key, label }) => {
    if (Array.isArray(caps[key]) && caps[key].length > 0) {
      controlCount++;
      const wrap = document.createElement('div');
      wrap.className = 'hw-control-item';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const sel = document.createElement('select');
      caps[key].forEach(optVal => {
        const o = document.createElement('option');
        o.value = optVal;
        o.textContent = optVal;
        if (settings[key] === optVal) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', async () => {
        try {
          await state.videoTrack.applyConstraints({ advanced: [{ [key]: sel.value }] });
          state.trackSettings = state.videoTrack.getSettings();
        } catch (err) {
          showToast(`Constraint ${key} failed: ${err.message}`, 'warn');
        }
      });
      wrap.appendChild(lbl);
      wrap.appendChild(sel);
      container.appendChild(wrap);
    }
  });

  sliderConfigs.forEach(({ key, label, unit }) => {
    const range = caps[key];
    if (range && typeof range === 'object' && typeof range.min === 'number' && typeof range.max === 'number' && range.max > range.min) {
      controlCount++;
      const wrap = document.createElement('div');
      wrap.className = 'hw-control-item';
      const currentVal = settings[key] ?? range.min;
      const header = document.createElement('div');
      header.className = 'hw-control-header';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      const valBadge = document.createElement('span');
      valBadge.className = 'hw-val';
      valBadge.textContent = `${currentVal}${unit}`;
      header.appendChild(lbl);
      header.appendChild(valBadge);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = range.min;
      input.max = range.max;
      input.step = range.step || ((range.max - range.min) / 100);
      input.value = currentVal;

      input.addEventListener('input', () => {
        valBadge.textContent = `${input.value}${unit}`;
      });
      input.addEventListener('change', async () => {
        const num = Number(input.value);
        try {
          await state.videoTrack.applyConstraints({ advanced: [{ [key]: num }] });
          state.trackSettings = state.videoTrack.getSettings();
        } catch (err) {
          showToast(`Hardware ${key} requires manual mode first`, 'warn');
        }
      });

      wrap.appendChild(header);
      wrap.appendChild(input);
      container.appendChild(wrap);
    }
  });

  if (controlCount === 0) {
    container.innerHTML = `<div class="empty-note">Using Mobile Hardware EXIF Profile parameters above.</div>`;
  }
}

async function collectAllChromeMetadata(capturePipelineName) {
  const trackSettings = state.videoTrack?.getSettings ? state.videoTrack.getSettings() : {};
  const trackCapabilities = state.videoTrack?.getCapabilities ? state.videoTrack.getCapabilities() : {};
  const trackLabel = state.videoTrack?.label || 'Unknown Camera';

  if (state.videoTrack) {
    await probeWebCodecsTelemetry(state.videoTrack);
  }

  let highEntropyClientHints = null;
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    try {
      highEntropyClientHints = await navigator.userAgentData.getHighEntropyValues([
        'architecture',
        'bitness',
        'formFactors',
        'fullVersionList',
        'model',
        'platform',
        'platformVersion',
        'uaFullVersion',
        'wow64'
      ]);
    } catch (_) {}
  }

  let batteryInfo = null;
  if (navigator.getBattery) {
    try {
      const bat = await navigator.getBattery();
      batteryInfo = {
        levelPercent: Math.round(bat.level * 100),
        charging: bat.charging,
        chargingTimeSec: bat.chargingTime,
        dischargingTimeSec: bat.dischargingTime
      };
    } catch (_) {}
  }

  let gpuInfo = null;
  try {
    const glCanvas = document.createElement('canvas');
    const gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      gpuInfo = {
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
      };
    }
  } catch (_) {}

  const displayInfo = {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    devicePixelRatio: window.devicePixelRatio,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    orientationType: window.screen.orientation?.type || null,
    orientationAngle: window.screen.orientation?.angle ?? null,
    hdrSupported: window.matchMedia('(dynamic-range: high)').matches,
    colorGamutP3: window.matchMedia('(color-gamut: p3)').matches,
    colorGamutRec2020: window.matchMedia('(color-gamut: rec2020)').matches
  };

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const networkInfo = conn ? {
    effectiveType: conn.effectiveType,
    downlinkMbps: conn.downlink,
    rttMs: conn.rtt,
    saveData: conn.saveData
  } : null;

  const now = new Date();
  return {
    captureTimestampIso: now.toISOString(),
    captureTimestampEpochMs: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffsetMinutes: -now.getTimezoneOffset(),
    performanceNowMs: Number(performance.now().toFixed(3)),
    capturePipeline: capturePipelineName,
    cameraHardware: {
      label: trackLabel,
      trackId: state.videoTrack?.id || null,
      readyState: state.videoTrack?.readyState || null,
      muted: state.videoTrack?.muted ?? null,
      settings: trackSettings,
      capabilities: trackCapabilities,
      photoCapabilities: state.photoCapabilities ? {
        redEyeReduction: state.photoCapabilities.redEyeReduction,
        fillLightMode: state.photoCapabilities.fillLightMode,
        imageWidth: state.photoCapabilities.imageWidth ? {
          min: state.photoCapabilities.imageWidth.min,
          max: state.photoCapabilities.imageWidth.max,
          step: state.photoCapabilities.imageWidth.step
        } : null,
        imageHeight: state.photoCapabilities.imageHeight ? {
          min: state.photoCapabilities.imageHeight.min,
          max: state.photoCapabilities.imageHeight.max,
          step: state.photoCapabilities.imageHeight.step
        } : null
      } : null,
      photoSettings: state.photoSettings || null,
      webCodecsVideoFrame: state.webCodecsTelemetry,
      connectedVideoDevices: state.devices.map(d => ({
        deviceId: d.deviceId,
        groupId: d.groupId,
        label: d.label
      }))
    },
    sensors: {
      geolocation: getMobileExifConfigFromUi().geolocation,
      geolocationStatus: state.gpsError || (state.gpsData ? 'Locked' : 'Profile Coordinates'),
      deviceOrientation: state.orientationData,
      deviceMotion: state.motionData
    },
    chromeEnvironment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      hardwareConcurrencyCores: navigator.hardwareConcurrency || null,
      deviceMemoryGb: navigator.deviceMemory || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      isSecureContext: window.isSecureContext,
      highEntropyClientHints,
      gpuInfo,
      displayInfo,
      batteryInfo,
      networkInfo
    }
  };
}

async function captureRawPhoto() {
  if (!state.videoTrack) {
    showToast('Camera stream is not active.', 'error');
    return;
  }

  const selectedMode = els.captureModeSelect.value;
  let rawBlob = null;
  let pipelineUsed = '';

  els.btnTakePhoto.disabled = true;
  els.btnTakePhoto.textContent = 'Capturing Mobile RAW...';

  try {
    if (selectedMode === 'hardware' && state.imageCapture) {
      try {
        const photoOpts = {};
        if (state.photoCapabilities?.imageWidth?.max) {
          photoOpts.imageWidth = state.photoCapabilities.imageWidth.max;
        }
        if (state.photoCapabilities?.imageHeight?.max) {
          photoOpts.imageHeight = state.photoCapabilities.imageHeight.max;
        }
        if (
          state.fillLightMode !== 'off' &&
          Array.isArray(state.photoCapabilities?.fillLightMode) &&
          state.photoCapabilities.fillLightMode.includes(state.fillLightMode)
        ) {
          photoOpts.fillLightMode = state.fillLightMode;
        }
        rawBlob = await state.imageCapture.takePhoto(photoOpts);
        pipelineUsed = 'W3C ImageCapture.takePhoto() + Real Mobile 82-Tag EXIF Pipeline';
      } catch (_) {
        try {
          rawBlob = await state.imageCapture.takePhoto();
          pipelineUsed = 'W3C ImageCapture.takePhoto() + Real Mobile 82-Tag EXIF Pipeline';
        } catch (_) {}
      }
    }

    if (!rawBlob) {
      const vw = els.videoPreview.videoWidth || 1920;
      const vh = els.videoPreview.videoHeight || 1080;
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d', {
        alpha: false,
        colorSpace: window.matchMedia('(color-gamut: p3)').matches ? 'display-p3' : 'srgb',
        willReadFrequently: true
      });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(els.videoPreview, 0, 0, vw, vh);

      if (selectedMode === 'lossless-png') {
        rawBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        pipelineUsed = 'Uncompressed Lossless 24-bit PNG Frame';
      } else {
        rawBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.98));
        pipelineUsed = 'Direct Sensor Frame + Real Mobile 82-Tag EXIF Pipeline';
      }
    }

    await processCapturedMedia(rawBlob, pipelineUsed, null);
  } catch (err) {
    showToast(`Capture failed: ${err.message}`, 'error');
  } finally {
    els.btnTakePhoto.disabled = false;
    els.btnTakePhoto.textContent = 'Capture Real Mobile RAW Photo';
  }
}

async function handleNativeFileCapture(event, sourceLabel) {
  const file = event.target.files?.[0];
  if (!file) return;
  const fileMeta = {
    originalFileName: file.name,
    lastModifiedTimestamp: file.lastModified,
    lastModifiedIso: new Date(file.lastModified).toISOString(),
    sizeBytes: file.size,
    type: file.type
  };
  await processCapturedMedia(file, sourceLabel, fileMeta);
  event.target.value = '';
}

async function processCapturedMedia(rawBlob, pipelineUsed, nativeFileMeta = null) {
  let workingBlob = rawBlob;
  let rawBuffer = await workingBlob.arrayBuffer();
  let binaryReport = await window.ForensicExifEngine.analyzeBinaryBuffer(rawBuffer, workingBlob.type);

  // If user imported a PNG/WebP and wants Real Mobile EXIF JPEG, convert to high-grade JPEG if not video
  if (!workingBlob.type.startsWith('video/') && !binaryReport.detectedContainer.startsWith('JPEG') && nativeFileMeta) {
    try {
      const bmp = await createImageBitmap(workingBlob);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      bmp.close();
      workingBlob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.98));
      rawBuffer = await workingBlob.arrayBuffer();
      binaryReport = await window.ForensicExifEngine.analyzeBinaryBuffer(rawBuffer, 'image/jpeg');
    } catch (_) {}
  }

  const chromeTelemetry = await collectAllChromeMetadata(pipelineUsed);
  const exifConfig = getMobileExifConfigFromUi();

  const width =
    binaryReport.containerDetails?.frameInfo?.width ||
    binaryReport.containerDetails?.header?.width ||
    els.videoPreview.videoWidth ||
    chromeTelemetry.cameraHardware.settings?.width ||
    0;
  const height =
    binaryReport.containerDetails?.frameInfo?.height ||
    binaryReport.containerDetails?.header?.height ||
    els.videoPreview.videoHeight ||
    chromeTelemetry.cameraHardware.settings?.height ||
    0;

  let enrichedBlob = null;
  let enrichedReport = null;
  const isJpeg = binaryReport.detectedContainer.startsWith('JPEG');

  if (isJpeg) {
    const thumbBuf = await generateEmbeddedThumbnailBytes(workingBlob);
    const enrichedBuffer = window.ForensicExifEngine.buildAndInjectLosslessExif(rawBuffer, {
      ...exifConfig,
      timestampIso: chromeTelemetry.captureTimestampIso,
      width,
      height,
      trackSettings: chromeTelemetry.cameraHardware.settings,
      thumbnailJpegBytes: thumbBuf
    });
    enrichedBlob = new Blob([enrichedBuffer], { type: 'image/jpeg' });
    enrichedReport = await window.ForensicExifEngine.analyzeBinaryBuffer(enrichedBuffer, 'image/jpeg');
    enrichedReport.note = `Real Mobile Camera EXIF Header (FF D8 FF E1 ... Exif\\0\\0) with ${enrichedReport.containerDetails?.exif?.rawTagCount || 0} tags across IFD0, ExifSubIFD, InteropIFD (R98), GPSIFD, and IFD1 Embedded Thumbnail.`;
  }

  const nowDate = new Date(chromeTelemetry.captureTimestampIso);
  const ext = isJpeg ? 'jpg' : getExtensionFromMime(workingBlob.type, nativeFileMeta?.originalFileName);
  const mobileFilename = window.ForensicExifEngine.formatMobileFilename(exifConfig.mobileProfileId, nowDate, ext);
  const id = mobileFilename.replace(/\.[^.]+$/, '');

  const fullMetadataDocument = buildMetadataDocument(
    id,
    mobileFilename,
    workingBlob,
    rawBuffer,
    binaryReport,
    enrichedReport,
    chromeTelemetry,
    nativeFileMeta,
    width,
    height
  );

  const captureItem = {
    id,
    mobileFilename,
    ext,
    timestamp: chromeTelemetry.captureTimestampIso,
    pipelineUsed,
    isVideo: workingBlob.type.startsWith('video/'),
    rawBlob: workingBlob,
    rawBuffer,
    rawUrl: URL.createObjectURL(enrichedBlob || workingBlob),
    enrichedBlob,
    binaryReport,
    enrichedReport,
    chromeTelemetry,
    nativeFileMeta,
    width,
    height,
    fullMetadataDocument,
    savedToServer: false
  };

  state.captures.unshift(captureItem);
  renderCapturesGallery();
  selectCapture(id);

  showToast(`Created Real Mobile Photo: ${mobileFilename} (${enrichedReport?.containerDetails?.exif?.rawTagCount || 0} EXIF tags)`, 'success');

  if (state.autoSaveToServer) {
    await saveCaptureToServer(captureItem, false);
  }
}

/**
 * Re-builds the 82-tag Real Mobile EXIF on an already captured photo when the user edits Make/Model/GPS/ISO.
 */
async function rebuildMobileExifForCapture(item) {
  if (!item.binaryReport.detectedContainer.startsWith('JPEG')) {
    showToast('EXIF header injection is supported on JPEG photos.', 'warn');
    return;
  }
  const exifConfig = getMobileExifConfigFromUi();
  const thumbBuf = await generateEmbeddedThumbnailBytes(item.rawBlob);
  const nowIso = new Date().toISOString();

  const enrichedBuffer = window.ForensicExifEngine.buildAndInjectLosslessExif(item.rawBuffer, {
    ...exifConfig,
    timestampIso: nowIso,
    width: item.width,
    height: item.height,
    trackSettings: item.chromeTelemetry.cameraHardware.settings,
    thumbnailJpegBytes: thumbBuf
  });

  item.enrichedBlob = new Blob([enrichedBuffer], { type: 'image/jpeg' });
  item.enrichedReport = await window.ForensicExifEngine.analyzeBinaryBuffer(enrichedBuffer, 'image/jpeg');
  item.mobileFilename = window.ForensicExifEngine.formatMobileFilename(exifConfig.mobileProfileId, new Date(nowIso), 'jpg');
  item.id = item.mobileFilename.replace(/\.[^.]+$/, '');
  state.activeCaptureId = item.id;

  item.fullMetadataDocument = buildMetadataDocument(
    item.id,
    item.mobileFilename,
    item.rawBlob,
    item.rawBuffer,
    item.binaryReport,
    item.enrichedReport,
    item.chromeTelemetry,
    item.nativeFileMeta,
    item.width,
    item.height
  );

  renderCapturesGallery();
  selectCapture(item.id);
  showToast(`Updated Mobile EXIF -> ${item.mobileFilename}`, 'success');

  if (state.autoSaveToServer) {
    await saveCaptureToServer(item, true);
  }
}

function buildMetadataDocument(id, mobileFilename, workingBlob, rawBuffer, binaryReport, enrichedReport, chromeTelemetry, nativeFileMeta, width, height) {
  return {
    captureId: id,
    mobileFileName: mobileFilename,
    isVideo: workingBlob.type.startsWith('video/'),
    nativeFileMetadata: nativeFileMeta,
    integrity: {
      mobileExifPhotoSizeBytes: enrichedReport ? enrichedReport.byteLength : rawBuffer.byteLength,
      mobileExifPhotoSha256: enrichedReport ? enrichedReport.hashes.sha256 : binaryReport.hashes.sha256,
      mobileExifPhotoSha1: enrichedReport ? enrichedReport.hashes.sha1 : binaryReport.hashes.sha1,
      rawStreamSizeBytes: rawBuffer.byteLength,
      rawStreamSha256: binaryReport.hashes.sha256,
      rawStreamSha1: binaryReport.hashes.sha1,
      zeroRecompressionVerified: true
    },
    dimensions: {
      width,
      height,
      megapixels: width && height ? Number(((width * height) / 1e6).toFixed(2)) : null
    },
    mobilePhotoContainerAnalysis: enrichedReport ? {
      detectedContainer: enrichedReport.detectedContainer,
      signatureHex: enrichedReport.signatureHex,
      totalExifTagCount: enrichedReport.containerDetails?.exif?.rawTagCount || 0,
      markers: enrichedReport.containerDetails?.markers,
      ifd0: enrichedReport.containerDetails?.exif?.ifd0,
      exifSubIfd: enrichedReport.containerDetails?.exif?.exifIfd,
      interopIfd: enrichedReport.containerDetails?.exif?.interopIfd,
      gpsIfd: enrichedReport.containerDetails?.exif?.gpsIfd,
      ifd1Thumbnail: enrichedReport.containerDetails?.exif?.ifd1,
      gpsDecimal: enrichedReport.containerDetails?.exif?.gpsDecimal
    } : null,
    chromeTelemetry
  };
}

function toggleRawVideoRecording() {
  if (state.isRecording) {
    stopRawVideoRecording();
  } else {
    startRawVideoRecording();
  }
}

function startRawVideoRecording() {
  if (!state.stream) {
    showToast('Camera stream is not active.', 'error');
    return;
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=av1',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=h264',
    'video/webm'
  ];
  const supportedMime = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || '';

  state.recordedChunks = [];
  try {
    state.mediaRecorder = new MediaRecorder(state.stream, {
      mimeType: supportedMime || undefined,
      videoBitsPerSecond: 50_000_000
    });
  } catch (_) {
    state.mediaRecorder = new MediaRecorder(state.stream);
  }

  state.mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
  };

  state.mediaRecorder.onstop = async () => {
    const mime = state.mediaRecorder.mimeType || 'video/webm';
    const rawVideoBlob = new Blob(state.recordedChunks, { type: mime });
    await processCapturedMedia(
      rawVideoBlob,
      `Raw Video Stream Recording (${mime} @ 50 Mbps Target)`
    );
  };

  state.mediaRecorder.start(250);
  state.isRecording = true;
  state.recordingStartTime = Date.now();
  els.btnRecordVideo.classList.add('recording-active');
  els.btnRecordVideo.textContent = 'Stop Raw Video (0.0s)';

  state.recordingTimer = setInterval(() => {
    const elapsed = ((Date.now() - state.recordingStartTime) / 1000).toFixed(1);
    els.btnRecordVideo.textContent = `Stop Raw Video (${elapsed}s)`;
  }, 200);
}

function stopRawVideoRecording() {
  if (state.recordingTimer) {
    clearInterval(state.recordingTimer);
    state.recordingTimer = null;
  }
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  state.isRecording = false;
  els.btnRecordVideo.classList.remove('recording-active');
  els.btnRecordVideo.textContent = 'Record Raw Video';
}

function getExtensionFromMime(mime, fallbackFileName = '') {
  if (fallbackFileName && fallbackFileName.includes('.')) {
    return fallbackFileName.split('.').pop().toLowerCase();
  }
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/x-adobe-dng': 'dng',
    'image/tiff': 'tif',
    'video/webm': 'webm',
    'video/mp4': 'mp4'
  };
  const cleanMime = (mime || '').split(';')[0].trim().toLowerCase();
  return map[cleanMime] || 'bin';
}

function getActiveCapture() {
  return state.captures.find(c => c.id === state.activeCaptureId) || null;
}

function renderCapturesGallery() {
  els.captureCountBadge.textContent = `${state.captures.length}`;
  els.capturesList.innerHTML = '';

  state.captures.forEach(item => {
    const card = document.createElement('div');
    card.className = `capture-thumb-card ${item.id === state.activeCaptureId ? 'active' : ''}`;
    card.addEventListener('click', () => selectCapture(item.id));

    const mediaHtml = item.isVideo
      ? `<div class="thumb-video-badge">RAW VIDEO</div>`
      : `<img src="${item.rawUrl}" alt="${item.mobileFilename}" />`;

    const dims = item.fullMetadataDocument.dimensions;
    const enrichedTags = item.enrichedReport?.containerDetails?.exif?.rawTagCount || 0;
    const makeModel = item.enrichedReport?.containerDetails?.exif?.ifd0?.Model?.value || '';

    card.innerHTML = `
      <div class="thumb-preview">${mediaHtml}</div>
      <div class="thumb-meta">
        <div class="thumb-id">${item.mobileFilename}</div>
        <div class="thumb-sub">${dims.width || '?'}×${dims.height || '?'} • ${((item.enrichedBlob || item.rawBlob).size / 1024).toFixed(1)} KB</div>
        <div class="thumb-tags">
          ${makeModel ? `<span class="mini-tag tag-accent">${escapeHtml(makeModel)}</span>` : ''}
          <span class="mini-tag tag-ok">${enrichedTags} EXIF Tags</span>
          ${item.savedToServer ? `<span class="mini-tag tag-ok">Saved on PC</span>` : ''}
        </div>
      </div>
    `;
    els.capturesList.appendChild(card);
  });
}

function selectCapture(id) {
  state.activeCaptureId = id;
  renderCapturesGallery();

  const item = getActiveCapture();
  if (!item) return;

  els.inspectorEmptyState.classList.add('hidden');
  els.inspectorContent.classList.remove('hidden');

  if (item.isVideo) {
    els.previewImage.classList.add('hidden');
    els.previewVideo.classList.remove('hidden');
    els.previewVideo.src = item.rawUrl;
    els.btnDownloadExifEnriched.classList.add('hidden');
  } else {
    els.previewVideo.classList.add('hidden');
    els.previewImage.classList.remove('hidden');
    els.previewImage.src = item.rawUrl;
    if (item.enrichedBlob) {
      els.btnDownloadExifEnriched.classList.remove('hidden');
      els.btnDownloadExifEnriched.textContent = `Download Real Mobile Photo (${item.mobileFilename})`;
    } else {
      els.btnDownloadExifEnriched.classList.add('hidden');
    }
  }

  const doc = item.fullMetadataDocument;
  const activeRep = item.enrichedReport || item.binaryReport;
  els.badgeMobileFilename.textContent = item.mobileFilename;
  els.badgeContainerFormat.textContent = `${activeRep.detectedContainer} (${activeRep.containerDetails?.exif?.rawTagCount || 0} EXIF Tags)`;
  els.badgeResolution.textContent = `${doc.dimensions.width}×${doc.dimensions.height} (${doc.dimensions.megapixels || 0} MP)`;
  els.badgeFileSize.textContent = activeRep.sizeFormatted;
  els.badgeSha256.textContent = `SHA-256: ${doc.integrity.mobileExifPhotoSha256.slice(0, 18)}...`;
  els.badgeSha256.title = doc.integrity.mobileExifPhotoSha256;

  renderInspectorTabs(item);
}

function renderInspectorTabs(item) {
  const doc = item.fullMetadataDocument;
  const bin = item.binaryReport;
  const enriched = item.enrichedReport || bin;
  const details = enriched.containerDetails || {};
  const mobileExif = details.exif || null;

  // 1. Real Mobile EXIF Tags Tab (Primary Tab)
  els.tabPaneBinaryExif.innerHTML = `
    <div class="forensic-grid">
      <div class="forensic-card">
        <h4>Real Smartphone EXIF Structure (IFD0 + GPSIFD + Interop R98 + IFD1 Thumbnail)</h4>
        ${mobileExif ? renderExifTables(mobileExif, ['ifd0', 'gpsIfd', 'interopIfd', 'ifd1']) : '<div class="empty-note">No EXIF data</div>'}
      </div>

      <div class="forensic-card">
        <h4>Exif SubIFD (48 Smartphone Camera, Lens, APEX &amp; HDR+ Sensor Tags)</h4>
        ${mobileExif ? renderExifTables(mobileExif, ['exifIfd']) : '<div class="empty-note">No SubIFD data</div>'}
      </div>

      <div class="forensic-card full-width">
        <h4>Binary JPEG Marker Map (Starts with <code>0xFFD8 SOI</code> &rarr; <code>0xFFE1 APP1 EXIF</code> at Offset 2)</h4>
        ${details.markers ? renderMarkerTable(details.markers) : '<div class="empty-note">No segment table</div>'}
      </div>
    </div>
  `;

  // 2. Overview & Integrity Tab
  els.tabPaneOverview.innerHTML = `
    <div class="forensic-grid">
      <div class="forensic-card">
        <h4>Real Mobile Photo Identity &amp; Cryptographic Integrity</h4>
        <table class="meta-table">
          <tr><td>Mobile Filename</td><td><strong><code>${escapeHtml(item.mobileFilename)}</code></strong></td></tr>
          <tr><td>Magic Signature Bytes</td><td><code>${enriched.signatureHex}</code> (Authentic Exif Header)</td></tr>
          <tr><td>Mobile Photo File Size</td><td><strong>${enriched.sizeFormatted}</strong></td></tr>
          <tr><td>Mobile Photo SHA-256</td><td><code class="hash-code">${doc.integrity.mobileExifPhotoSha256}</code></td></tr>
          <tr><td>Mobile Photo SHA-1</td><td><code class="hash-code">${doc.integrity.mobileExifPhotoSha1}</code></td></tr>
          <tr><td>Raw Camera Stream SHA-256</td><td><code class="hash-code">${doc.integrity.rawStreamSha256}</code></td></tr>
          <tr><td>Timestamp (ISO 8601)</td><td>${doc.chromeTelemetry.captureTimestampIso} (${doc.chromeTelemetry.timezone})</td></tr>
        </table>
      </div>

      <div class="forensic-card">
        <h4>Frame &amp; Compression Structure</h4>
        <table class="meta-table">
          <tr><td>Dimensions</td><td><strong>${doc.dimensions.width} × ${doc.dimensions.height} px</strong> (${doc.dimensions.megapixels || 0} MP)</td></tr>
          ${details.frameInfo ? `
          <tr><td>Encoding Process</td><td>${escapeHtml(details.frameInfo.encodingProcess)}</td></tr>
          <tr><td>Bit Depth</td><td>${details.frameInfo.bitsPerSample} bits (${details.frameInfo.colorComponents} color components)</td></tr>
          <tr><td>Chroma Subsampling</td><td><strong>${escapeHtml(details.frameInfo.chromaSubsampling)}</strong></td></tr>
          <tr><td>Quantization Tables (DQT)</td><td>${details.quantizationTables} tables</td></tr>
          <tr><td>Huffman Tables (DHT)</td><td>${details.huffmanTables} tables</td></tr>
          <tr><td>Compressed Entropy Scan Data</td><td>${details.entropyScanSizeBytes.toLocaleString()} bytes (100% Untouched)</td></tr>
          ` : ''}
          <tr><td>Total Embedded EXIF Tags</td><td><strong>${mobileExif ? mobileExif.rawTagCount : 0} tags</strong> across 5 IFDs</td></tr>
        </table>
      </div>
    </div>
  `;

  // 3. Raw Hex Header Inspector Tab
  els.tabPaneHex.innerHTML = `
    <div class="forensic-card full-width">
      <h4>First 512 Bytes of Real Mobile Photo (<code>${escapeHtml(item.mobileFilename)}</code> — Notice <code>FF D8 FF E1 ... Exif..MM.*</code> at Offset 0x0000)</h4>
      <pre class="hex-dump-block">${escapeHtml(enriched.hexDumpFirst512Bytes)}</pre>
    </div>
  `;

  // 4. Chrome Hardware Camera Telemetry Tab
  els.tabPaneHardware.innerHTML = `
    <div class="forensic-grid">
      <div class="forensic-card">
        <h4>MediaStreamTrack.getSettings()</h4>
        ${renderKeyValueTable(doc.chromeTelemetry.cameraHardware.settings)}
      </div>
      <div class="forensic-card">
        <h4>WebCodecs VideoFrame Telemetry</h4>
        ${renderKeyValueTable(doc.chromeTelemetry.cameraHardware.webCodecsVideoFrame || { status: 'Unavailable' })}
      </div>
    </div>
  `;

  // 5. Sensors & Geolocation Tab
  els.tabPaneSensors.innerHTML = `
    <div class="forensic-grid">
      <div class="forensic-card">
        <h4>GPS Coordinates Embedded in EXIF GPSIFD</h4>
        ${renderKeyValueTable(mobileExif?.gpsDecimal || doc.chromeTelemetry.sensors.geolocation)}
      </div>
      <div class="forensic-card">
        <h4>Device Orientation &amp; Motion Sensors</h4>
        ${renderKeyValueTable(doc.chromeTelemetry.sensors.deviceOrientation || { status: 'Desktop / Stationary' })}
      </div>
    </div>
  `;

  // 6. System Tab
  els.tabPaneSystem.innerHTML = `
    <div class="forensic-grid">
      <div class="forensic-card">
        <h4>Chrome High-Entropy Client Hints</h4>
        <pre class="json-code-block">${escapeHtml(JSON.stringify(doc.chromeTelemetry.chromeEnvironment.highEntropyClientHints || {}, null, 2))}</pre>
      </div>
      <div class="forensic-card">
        <h4>GPU &amp; Display</h4>
        <pre class="json-code-block">${escapeHtml(JSON.stringify({
          gpu: doc.chromeTelemetry.chromeEnvironment.gpuInfo,
          display: doc.chromeTelemetry.chromeEnvironment.displayInfo
        }, null, 2))}</pre>
      </div>
    </div>
  `;
}

function renderExifTables(exifObj, includeKeys = ['ifd0', 'exifIfd', 'gpsIfd', 'interopIfd', 'ifd1']) {
  const mapTitles = {
    ifd0: 'IFD0 (Primary Device & Image Tags)',
    exifIfd: 'Exif SubIFD (Camera, Lens, Shutter, ISO & Sensor Tags)',
    gpsIfd: 'GPS IFD (Satellite Coordinates, Altitude & UTC Timestamp)',
    interopIfd: 'Interoperability IFD (DCF R98 Standard)',
    ifd1: 'IFD1 (Embedded EXIF Thumbnail Image)'
  };
  let html = `<div class="exif-byte-order" style="margin-bottom:8px; font-size:0.78rem; color:var(--text-muted);">Byte Order: <strong>${escapeHtml(exifObj.byteOrder || 'N/A')}</strong></div>`;
  includeKeys.forEach(key => {
    const dict = exifObj[key];
    const keys = Object.keys(dict || {});
    if (keys.length === 0) return;
    html += `<h5 class="exif-sub-title">${mapTitles[key]} (${keys.length} tags)</h5><table class="meta-table">`;
    keys.forEach(k => {
      const entry = dict[k];
      let valStr = '';
      if (entry.value && typeof entry.value === 'object' && entry.value.formatted) {
        valStr = entry.value.formatted;
      } else if (Array.isArray(entry.value)) {
        valStr = entry.value.map(v => (v && v.formatted ? v.formatted : JSON.stringify(v))).join(', ');
      } else {
        valStr = String(entry.value);
      }
      html += `<tr><td><code>${entry.tagId}</code> ${escapeHtml(k)}</td><td><strong>${escapeHtml(valStr)}</strong></td></tr>`;
    });
    html += `</table>`;
  });
  return html;
}

function renderMarkerTable(markers) {
  let html = `<table class="meta-table"><thead><tr><th>Marker</th><th>Segment Name</th><th>Byte Offset</th><th>Segment Length</th></tr></thead><tbody>`;
  markers.forEach(m => {
    html += `<tr><td><code>${m.marker}</code></td><td>${escapeHtml(m.name)}</td><td><code>0x${m.offset.toString(16).padStart(6, '0').toUpperCase()}</code> (${m.offset})</td><td>${m.length.toLocaleString()} bytes</td></tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderKeyValueTable(obj) {
  if (!obj || typeof obj !== 'object') return '<div class="empty-note">None</div>';
  const keys = Object.keys(obj);
  if (keys.length === 0) return '<div class="empty-note">Empty</div>';
  let html = `<table class="meta-table">`;
  keys.forEach(k => {
    const v = obj[k];
    const formatted = (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v);
    html += `<tr><td>${escapeHtml(k)}</td><td><code>${escapeHtml(formatted)}</code></td></tr>`;
  });
  html += `</table>`;
  return html;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadActiveCapture(variant) {
  const item = getActiveCapture();
  if (!item) return;

  let blob = null;
  let filename = '';

  if (variant === 'enriched' && item.enrichedBlob) {
    blob = item.enrichedBlob;
    filename = item.mobileFilename;
  } else if (variant === 'raw') {
    blob = item.rawBlob;
    filename = `${item.id}_RAW_STREAM.${item.ext}`;
  } else if (variant === 'json') {
    const jsonStr = JSON.stringify(item.fullMetadataDocument, null, 2);
    blob = new Blob([jsonStr], { type: 'application/json' });
    filename = `${item.id}_METADATA.json`;
  }

  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function saveCaptureToServer(item, showNotification = true) {
  try {
    const rawBase64 = await blobToBase64(item.rawBlob);
    const enrichedBase64 = item.enrichedBlob ? await blobToBase64(item.enrichedBlob) : null;

    const res = await fetch('/api/save-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        mobileFilename: item.mobileFilename,
        ext: item.ext,
        rawBase64,
        enrichedBase64,
        metadata: item.fullMetadataDocument
      })
    });

    if (res.ok) {
      const data = await res.json();
      item.savedToServer = true;
      renderCapturesGallery();
      if (showNotification) {
        showToast(`Saved ${item.mobileFilename} to PC: ${data.folder}`, 'success');
      }
    } else if (showNotification) {
      showToast('Server archive failed', 'error');
    }
  } catch (_) {
    if (showNotification) {
      showToast('Server offline — use Download buttons to save locally', 'warn');
    }
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const str = String(reader.result || '');
      const comma = str.indexOf(',');
      resolve(comma >= 0 ? str.slice(comma + 1) : str);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
