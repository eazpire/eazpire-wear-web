/**
 * Camera-only proof capture (getUserMedia) — photo or video, no file picker.
 */
(function (global) {
  "use strict";

  var state = {
    stream: null,
    facingMode: "user",
    mode: "photo",
    blob: null,
    previewUrl: null,
    proofKind: null,
    recorder: null,
    recordChunks: [],
    recording: false,
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function stopRecording() {
    if (state.recorder && state.recording) {
      try {
        state.recorder.stop();
      } catch (e) {
        /* ignore */
      }
    }
    state.recording = false;
    updateRecordingUi(false);
  }

  function stopStream() {
    stopRecording();
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) {
        t.stop();
      });
      state.stream = null;
    }
  }

  function clearPreview() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
    state.blob = null;
    state.proofKind = null;
    state.recordChunks = [];
  }

  function hideAllPreviews() {
    var imgPreview = qs("feedCameraPreview");
    var vidPreview = qs("feedCameraPreviewVideo");
    if (imgPreview) {
      imgPreview.hidden = true;
      imgPreview.removeAttribute("src");
    }
    if (vidPreview) {
      vidPreview.hidden = true;
      vidPreview.pause();
      vidPreview.removeAttribute("src");
    }
  }

  function pickVideoMimeType() {
    var types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    if (!global.MediaRecorder || !MediaRecorder.isTypeSupported) return "video/webm";
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "video/webm";
  }

  function updateModeUi() {
    var isPhoto = state.mode === "photo";
    document.querySelectorAll("[data-camera-mode]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-camera-mode") === state.mode);
    });
    var capBtn = qs("feedCameraCapture");
    if (capBtn) {
      capBtn.textContent = isPhoto ? "Capture" : state.recording ? "Stop" : "Record";
      capBtn.classList.toggle("is-recording", !isPhoto && state.recording);
    }
    var retakeBtn = qs("feedCameraRetake");
    if (retakeBtn) retakeBtn.hidden = !state.blob;
    if (capBtn) capBtn.hidden = !!state.blob;
    var flipBtn = qs("feedCameraFlip");
    if (flipBtn) flipBtn.disabled = !!state.blob || state.recording;
    document.querySelectorAll("[data-camera-mode]").forEach(function (btn) {
      btn.disabled = !!state.blob || state.recording;
    });
  }

  function updateRecordingUi(active) {
    var stage = document.querySelector(".feed-camera-stage");
    if (stage) stage.classList.toggle("is-recording", !!active);
    updateModeUi();
  }

  function waitNextFrames(count) {
    return new Promise(function (resolve) {
      function step(left) {
        if (left <= 0) return resolve();
        requestAnimationFrame(function () {
          step(left - 1);
        });
      }
      step(typeof count === "number" ? count : 2);
    });
  }

  function setComposeCameraMode(on) {
    var floatEl = qs("feedComposeFloat");
    if (floatEl) floatEl.classList.toggle("is-camera-open", !!on);
    if (on && global.CommunityFeedComposeFloat && global.CommunityFeedComposeFloat.expand) {
      global.CommunityFeedComposeFloat.expand();
    }
  }

  async function attachLiveVideo(video) {
    if (!video || !state.stream) return false;

    video.srcObject = state.stream;
    video.hidden = false;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    await new Promise(function (resolve) {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      video.addEventListener("loadedmetadata", finish, { once: true });
      video.addEventListener("canplay", finish, { once: true });
      setTimeout(finish, 2500);
    });

    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await video.play();
        if (video.videoWidth > 0 && video.videoHeight > 0) return true;
      } catch (e) {
        /* retry after layout settles */
      }
      await new Promise(function (r) {
        setTimeout(r, 80 * (attempt + 1));
      });
    }
    return video.videoWidth > 0 && video.videoHeight > 0;
  }

  async function startCamera() {
    stopStream();
    clearPreview();
    hideAllPreviews();

    var video = qs("feedCameraVideo");
    var fallback = qs("feedCameraFallback");
    var panel = qs("feedCameraPanel");
    if (!video) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = "Camera not available in this browser. Use a phone with HTTPS.";
      }
      return;
    }

    if (panel) panel.hidden = false;
    await waitNextFrames(2);

    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: state.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: state.mode === "video",
      });

      var liveOk = await attachLiveVideo(video);
      if (fallback) {
        if (liveOk) {
          fallback.hidden = true;
        } else {
          fallback.hidden = false;
          fallback.textContent =
            "Camera is on but preview did not start. Try Flip camera or close and reopen.";
        }
      }
    } catch (e) {
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = "Camera permission denied or unavailable.";
      }
    }
    updateModeUi();
  }

  function showPhotoPreview(blob) {
    var preview = qs("feedCameraPreview");
    var video = qs("feedCameraVideo");
    clearPreview();
    state.blob = blob;
    state.proofKind = "photo";
    state.previewUrl = URL.createObjectURL(blob);
    hideAllPreviews();
    if (preview) {
      preview.src = state.previewUrl;
      preview.hidden = false;
    }
    if (video) video.hidden = true;
    updateModeUi();
  }

  function showVideoPreview(blob) {
    var preview = qs("feedCameraPreviewVideo");
    var video = qs("feedCameraVideo");
    clearPreview();
    state.blob = blob;
    state.proofKind = "video";
    state.previewUrl = URL.createObjectURL(blob);
    hideAllPreviews();
    if (preview) {
      preview.src = state.previewUrl;
      preview.hidden = false;
      preview.play().catch(function () {});
    }
    if (video) video.hidden = true;
    updateModeUi();
  }

  function capturePhoto() {
    var video = qs("feedCameraVideo");
    var canvas = qs("feedCameraCanvas");
    if (!video || !canvas) return Promise.resolve(false);

    var w = video.videoWidth || 720;
    var h = video.videoHeight || 720;
    var size = Math.min(w, h);
    canvas.width = size;
    canvas.height = size;
    var sx = (w - size) / 2;
    var sy = (h - size) / 2;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    return new Promise(function (resolve) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            resolve(false);
            return;
          }
          showPhotoPreview(blob);
          resolve(true);
        },
        "image/jpeg",
        0.92
      );
    });
  }

  function startVideoRecording() {
    if (!state.stream || state.recording) return;
    if (!global.MediaRecorder) {
      alert("Video recording is not supported in this browser.");
      return;
    }

    var mimeType = pickVideoMimeType();
    state.recordChunks = [];
    try {
      state.recorder = new MediaRecorder(state.stream, { mimeType: mimeType });
    } catch (e) {
      alert("Video recording is not supported in this browser.");
      return;
    }

    state.recorder.ondataavailable = function (ev) {
      if (ev.data && ev.data.size > 0) state.recordChunks.push(ev.data);
    };

    state.recorder.onstop = function () {
      state.recording = false;
      updateRecordingUi(false);
      if (!state.recordChunks.length) return;
      var blob = new Blob(state.recordChunks, { type: state.recorder.mimeType || mimeType });
      state.recordChunks = [];
      if (blob.size > 0) showVideoPreview(blob);
    };

    state.recorder.start(250);
    state.recording = true;
    updateRecordingUi(true);
  }

  function stopVideoRecording() {
    if (state.recorder && state.recording) {
      state.recorder.stop();
    }
    state.recording = false;
    updateRecordingUi(false);
  }

  function handleCaptureClick() {
    if (state.mode === "photo") {
      capturePhoto();
      return;
    }
    if (state.recording) stopVideoRecording();
    else startVideoRecording();
  }

  function retake() {
    stopRecording();
    clearPreview();
    hideAllPreviews();
    var video = qs("feedCameraVideo");
    if (video) video.hidden = false;
    updateModeUi();
    startCamera();
  }

  async function flipCamera() {
    if (state.blob || state.recording) return;
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    await startCamera();
  }

  async function setMode(mode) {
    if (state.blob || state.recording) return;
    var next = mode === "video" ? "video" : "photo";
    if (state.mode === next) return;
    state.mode = next;
    updateModeUi();
    await startCamera();
  }

  function resetState() {
    stopStream();
    clearPreview();
    hideAllPreviews();
    state.mode = "photo";
    state.facingMode = "user";
    var video = qs("feedCameraVideo");
    if (video) {
      video.hidden = false;
      video.srcObject = null;
    }
    var fallback = qs("feedCameraFallback");
    if (fallback) fallback.hidden = true;
    updateModeUi();
  }

  function getProofBlob() {
    return state.blob || null;
  }

  function getProofKind() {
    return state.proofKind || null;
  }

  function hasProof() {
    return !!state.blob;
  }

  function bind() {
    var flipBtn = qs("feedCameraFlip");
    var capBtn = qs("feedCameraCapture");
    var retakeBtn = qs("feedCameraRetake");
    var cancelBtn = qs("feedCameraCancel");

    if (flipBtn) flipBtn.addEventListener("click", flipCamera);
    if (capBtn) capBtn.addEventListener("click", handleCaptureClick);
    if (retakeBtn) {
      retakeBtn.addEventListener("click", retake);
      retakeBtn.hidden = true;
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        cancel();
      });
    }
    document.querySelectorAll("[data-camera-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMode(btn.getAttribute("data-camera-mode"));
      });
    });
    updateModeUi();
  }

  async function openPanel() {
    setComposeCameraMode(true);
    var panel = qs("feedCameraPanel");
    if (panel) panel.hidden = false;
    resetState();
    await waitNextFrames(2);
    await startCamera();
  }

  function closePanel() {
    var panel = qs("feedCameraPanel");
    if (panel) panel.hidden = true;
    resetState();
    setComposeCameraMode(false);
  }

  function cancel() {
    closePanel();
  }

  global.CommunityFeedCamera = {
    bind: bind,
    openPanel: openPanel,
    closePanel: closePanel,
    cancel: cancel,
    startCamera: startCamera,
    capturePhoto: capturePhoto,
    retake: retake,
    flipCamera: flipCamera,
    setMode: setMode,
    getProofBlob: getProofBlob,
    getProofKind: getProofKind,
    hasProof: hasProof,
  };
})(window);
