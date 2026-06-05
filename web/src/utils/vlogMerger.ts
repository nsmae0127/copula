/**
 * Merges a list of video URLs into a single video file on the client-side
 * using HTML5 Canvas and MediaRecorder, with optional BGM and overlay filters.
 */
export async function mergeVideos(
  urls: string[],
  onProgress?: (progress: number) => void,
  options: { bgm?: string; filter?: string } = {}
): Promise<Blob> {
  if (urls.length === 0) {
    throw new Error("병합할 비디오 파일이 없습니다.");
  }

  const { bgm = "none", filter = "none" } = options;

  // Create canvas for rendering frames
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280; // 9:16 aspect ratio

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context를 생성할 수 없습니다.");
  }

  // Set up video element for playing segments
  const video = document.createElement("video");
  video.style.display = "none";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  document.body.appendChild(video);

  // Set up audio destination for BGM mixing
  let audioContext: AudioContext | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  let bgmAudio: HTMLAudioElement | null = null;
  let audioTrack: MediaStreamTrack | null = null;

  if (bgm !== "none") {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      bgmAudio = document.createElement("audio");
      // BGM MP3 파일 연동
      bgmAudio.src = `/assets/audio/bgm-${bgm}.mp3`;
      bgmAudio.loop = true;
      bgmAudio.crossOrigin = "anonymous";
      
      const source = audioContext.createMediaElementSource(bgmAudio);
      dest = audioContext.createMediaStreamDestination();
      source.connect(dest);
      
      if (dest.stream.getAudioTracks().length > 0) {
        audioTrack = dest.stream.getAudioTracks()[0];
      }
    } catch (e) {
      console.warn("BGM 로드 실패. 오디오 믹싱 없이 합성을 기동합니다.", e);
    }
  }

  // Capture canvas stream at 30 FPS
  const videoStream = canvas.captureStream(30);
  const combinedStream = new MediaStream();

  // Add video track
  videoStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

  // Add mixed audio track if available
  if (audioTrack) {
    combinedStream.addTrack(audioTrack);
  }

  // Pick a supported video mimeType
  let mimeType = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm;codecs=vp8";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/mp4";
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, { mimeType });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      // Clean up resources
      document.body.removeChild(video);
      if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.remove();
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
      const mergedBlob = new Blob(chunks, { type: mimeType });
      resolve(mergedBlob);
    };

    recorder.onerror = (e) => {
      document.body.removeChild(video);
      if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.remove();
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
      reject(e);
    };

    // Start BGM playback if exists
    if (bgmAudio) {
      bgmAudio.play().catch((err) => {
        console.warn("배경 음악 재생 실패 (사용자 상호작용 필요):", err);
      });
    }

    // Start recording
    recorder.start();

    // Sequentially play and record each video
    (async () => {
      try {
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          
          // Wait for video to load
          await new Promise<void>((resolveVideoLoad, rejectVideoLoad) => {
            video.src = url;
            video.oncanplaythrough = () => resolveVideoLoad();
            video.onerror = () => rejectVideoLoad(new Error(`${url} 비디오를 로드할 수 없습니다.`));
            video.load();
          });

          // Play video segment
          await video.play().catch(() => {});

          const segmentDuration = 1000; // Play exactly 1 second
          const startTime = performance.now();

          await new Promise<void>((resolveSegment) => {
            function drawFrame() {
              const elapsed = performance.now() - startTime;
              if (elapsed >= segmentDuration) {
                resolveSegment();
                return;
              }

              if (ctx) {
                ctx.save();
                const canvasW = canvas.width;
                const canvasH = canvas.height;

                // 1. Theme Filter Layout Rendering
                if (filter === "polaroid") {
                  // White polaroid backframe
                  ctx.fillStyle = "#FDFBF7";
                  ctx.fillRect(0, 0, canvasW, canvasH);

                  // Main video square aspect ratio
                  const videoSize = 640;
                  const videoX = 40;
                  const videoY = 100;

                  const videoAspect = video.videoWidth / video.videoHeight;
                  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

                  if (videoAspect > 1) {
                    sw = video.videoHeight;
                    sx = (video.videoWidth - sw) / 2;
                  } else {
                    sh = video.videoWidth;
                    sy = (video.videoHeight - sh) / 2;
                  }

                  ctx.drawImage(video, sx, sy, sw, sh, videoX, videoY, videoSize, videoSize);

                  // Thin photo shadow
                  ctx.strokeStyle = "rgba(0,0,0,0.06)";
                  ctx.lineWidth = 2;
                  ctx.strokeRect(videoX, videoY, videoSize, videoSize);

                  // Polaroid title
                  ctx.fillStyle = "#5C554E";
                  ctx.font = "italic 36px 'Courier New', monospace";
                  ctx.textAlign = "center";
                  ctx.fillText("Daily Memories", canvasW / 2, 860);

                  // Date
                  ctx.fillStyle = "rgba(92, 85, 78, 0.6)";
                  ctx.font = "26px sans-serif";
                  const dateStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
                  ctx.fillText(dateStr, canvasW / 2, 920);

                  // Vintage film tint overlay
                  ctx.fillStyle = "rgba(240, 113, 122, 0.03)";
                  ctx.fillRect(videoX, videoY, videoSize, videoSize);
                } else {
                  // Normal Cover Layout
                  const canvasAspect = canvasW / canvasH;
                  const videoAspect = video.videoWidth / video.videoHeight;
                  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

                  if (videoAspect > canvasAspect) {
                    sw = video.videoHeight * canvasAspect;
                    sx = (video.videoWidth - sw) / 2;
                  } else if (videoAspect < canvasAspect) {
                    sh = video.videoWidth / canvasAspect;
                    sy = (video.videoHeight - sh) / 2;
                  }
                  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
                }

                // 2. Custom overlay indicators
                if (filter === "rec") {
                  ctx.strokeStyle = "#FFFFFF";
                  ctx.lineWidth = 4;
                  const edge = 40;
                  const pad = 30;

                  // Viewfinder corners
                  ctx.beginPath();
                  ctx.moveTo(pad + edge, pad); ctx.lineTo(pad, pad); ctx.lineTo(pad, pad + edge);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.moveTo(canvasW - pad - edge, pad); ctx.lineTo(canvasW - pad, pad); ctx.lineTo(canvasW - pad, pad + edge);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.moveTo(pad + edge, canvasH - pad); ctx.lineTo(pad, canvasH - pad); ctx.lineTo(pad, canvasH - pad - edge);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.moveTo(canvasW - pad - edge, canvasH - pad); ctx.lineTo(canvasW - pad, canvasH - pad); ctx.lineTo(canvasW - pad, canvasH - pad - edge);
                  ctx.stroke();

                  // Blink REC circle
                  const blink = Math.floor(performance.now() / 500) % 2 === 0;
                  ctx.fillStyle = blink ? "#FF3B30" : "rgba(255, 59, 48, 0.2)";
                  ctx.beginPath();
                  ctx.arc(60, 75, 12, 0, Math.PI * 2);
                  ctx.fill();

                  // REC Text
                  ctx.fillStyle = "#FFFFFF";
                  ctx.font = "bold 28px monospace";
                  ctx.textAlign = "left";
                  ctx.fillText("REC", 85, 84);

                  // Battery icon
                  ctx.strokeStyle = "#FFFFFF";
                  ctx.strokeRect(canvasW - 90, 58, 50, 24);
                  ctx.fillStyle = "#FFFFFF";
                  ctx.fillRect(canvasW - 86, 62, 34, 16);
                  ctx.fillRect(canvasW - 40, 65, 4, 10);

                  // Date time record
                  ctx.font = "bold 26px monospace";
                  ctx.textAlign = "right";
                  const now = new Date();
                  const timeStr = now.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
                  ctx.fillText(`${dateStr} ${timeStr}`, canvasW - 40, canvasH - 40);
                } else if (filter !== "polaroid") {
                  // Normal Watermark
                  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                  ctx.font = "bold 24px sans-serif";
                  ctx.textAlign = "left";
                  ctx.fillText("1s Vlog", 32, canvasH - 32);
                }

                ctx.restore();
              }

              // Ensure video plays sequentially
              if (video.paused && !video.ended) {
                video.play().catch(() => {});
              }

              requestAnimationFrame(drawFrame);
            }

            drawFrame();
          });

          video.pause();

          if (onProgress) {
            onProgress((i + 1) / urls.length);
          }
        }

        // Stop recording
        recorder.stop();
      } catch (err) {
        recorder.stop();
        reject(err);
      }
    })();
  });
}
