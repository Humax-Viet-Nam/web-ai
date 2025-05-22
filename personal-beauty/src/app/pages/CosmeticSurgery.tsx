/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/display-name */
// src/components/page/CosmeticSurgery.tsx

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AnalysisLayout from "../components/AnalysisLayout";
import { useWebcam } from "../context/WebcamContext";
import { useLoading } from "../context/LoadingContext";
import { VIEWS } from "../constants/views";
import { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { AnalyzedResult, FaceWarper, IDEAL_RATIOS } from "../libs/faceWarper";

export default function CosmeticSurgery() {
  const {
    stream,
    error: webcamError,
    detectionResults,
    setCurrentView,
  } = useWebcam();
  const { setIsLoading } = useLoading();
  const [error, setError] = useState<string | null>(null);
  const lastStableTime = useRef<number | null>(null);
  const lastUnstableTime = useRef<number | null>(null);
  const STABILITY_THRESHOLD = 15;
  const HISTORY_SIZE = 5;
  const STABILITY_DURATION = 1000;
  const MIN_STABLE_DURATION = 500;
  const [statusMessage, setStatusMessage] = useState<string>(
    "Initializing camera..."
  );
  const [isFrameStable, setIsFrameStable] = useState(false);
  const landmarkHistoryRef = useRef<{ x: number; y: number }[][]>([]);
  const [noFaceDetectedDuration, setNoFaceDetectedDuration] =
    useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const optimizedCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastDetectTime = useRef(0);

  // New state for countdown and image capture
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownStartTimeRef = useRef<number | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(
    null
  );
  const [analyzedResult, setAnalyzedResult] = useState<AnalyzedResult | null>(
    null
  );
  const [optimizedImageData, setOptimizedImageData] =
    useState<ImageData | null>(null);
  const [sumary, setSummary] = useState<string | null>(null);
  const [canvasDiemensions, setCanvasDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: 640,
    height: 480,
  });

  // Làm rõ nét các text trên canvas
  useEffect(() => {
    setCurrentView(VIEWS.COSMETIC_SURGERY);
    if (canvasRef.current && resultCanvasRef.current) {
      const resultCanvas = resultCanvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // setCanvasDimensions({ width: rect.width * dpr, height: rect.height * dpr });
      resultCanvas.width = rect.width * dpr;
      resultCanvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      const resultCtx = resultCanvas.getContext("2d");
      if (ctx && resultCtx) {
        ctx.scale(dpr, dpr); // scale context để nội dung không bị phóng to
        resultCtx.scale(dpr, dpr); // scale context để nội dung không bị phóng to
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }
    }
  }, []);

  const checkFrameStability = useCallback(
    (landmarks: { x: number; y: number }[]) => {
      const newHistory = [...landmarkHistoryRef.current, landmarks].slice(
        -HISTORY_SIZE
      );
      if (!detectionResults.face?.faceLandmarks) {
        setNoFaceDetectedDuration((prev) => prev + 1000);
        if (noFaceDetectedDuration >= 30000) {
          setStatusMessage(
            "Face not detected for a long time. Please refresh the camera."
          );
        } else {
          setStatusMessage("Face not detected. Please adjust your position.");
        }
        setProgress(0);
        setIsFrameStable(false);
        landmarkHistoryRef.current = []; // reset

        // Reset countdown if face is lost
        if (countdownActive) {
          resetCountdown();
        }
        return;
      }

      setNoFaceDetectedDuration(0);

      if (newHistory.length < HISTORY_SIZE) {
        setStatusMessage("Collecting face data...");
        setProgress(20);
        landmarkHistoryRef.current = newHistory;
        return;
      }

      let totalDeviation = 0;
      let deviationCount = 0;

      for (let i = 1; i < newHistory.length; i++) {
        for (let j = 0; j < landmarks.length; j++) {
          const dx = (newHistory[i][j].x - newHistory[i - 1][j].x) * 640;
          const dy = (newHistory[i][j].y - newHistory[i - 1][j].y) * 480;
          const distance = Math.sqrt(dx * dx + dy * dy);
          totalDeviation += distance;
          deviationCount++;
        }
      }

      const averageDeviation =
        deviationCount > 0 ? totalDeviation / deviationCount : 0;
      const now = performance.now();
      const isStable = averageDeviation < STABILITY_THRESHOLD;

      if (isStable && !lastStableTime.current) {
        lastStableTime.current = now;
        setStatusMessage("Analyzing face...");
        setProgress(60);
      } else if (
        isStable &&
        lastStableTime.current &&
        now - lastStableTime.current >= STABILITY_DURATION
      ) {
        setIsFrameStable(true);

        // Only start countdown if it's not already active
        if (!countdownActive && !capturedImage) {
          startCountdown();
        }

        if (countdownActive) {
          setStatusMessage(`Keep still! Capturing in ${countdownValue}s...`);
        }
        setProgress(100);
        lastUnstableTime.current = null;
      } else if (!isStable) {
        if (
          lastStableTime.current &&
          now - lastStableTime.current < MIN_STABLE_DURATION
        ) {
          landmarkHistoryRef.current = newHistory;
          return;
        }
        if (!lastUnstableTime.current) {
          lastUnstableTime.current = now;
        }
        lastStableTime.current = null;
        setIsFrameStable(false);

        // Reset countdown if face becomes unstable during countdown
        if (countdownActive) {
          resetCountdown();
        }

        setStatusMessage("Please keep your face steady for analysis");
        setProgress(20);
      }

      landmarkHistoryRef.current = newHistory;
    },
    [
      HISTORY_SIZE,
      STABILITY_THRESHOLD,
      STABILITY_DURATION,
      MIN_STABLE_DURATION,
      detectionResults,
      noFaceDetectedDuration,
      countdownActive,
      countdownValue,
      capturedImage,
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const resultCanvas = resultCanvasRef.current;
    if (!canvas || !resultCanvas) return;

    // Set explicit sizes for both canvases
    // if (resultCanvas.width !== 640 || resultCanvas.height !== 480) {
    //   resultCanvas.width = 640;
    //   resultCanvas.height = 480;
    // }

    const ctx = canvas.getContext("2d");
    const resultCtx = resultCanvas.getContext("2d");
    if (
      !ctx ||
      !resultCtx ||
      !capturedImage ||
      !originalImageData ||
      !landmarks.length
    )
      return;
    // makeCanvasQuality(resultCanvas, resultCtx);
    const faceWarper = new FaceWarper(landmarks, canvas.width, canvas.height);
    faceWarper.setOriginalImageData(originalImageData);
    const result = faceWarper.calculateWarpingParametersWithFeedback();
    setAnalyzedResult(result);
    const {
      foreheadHeightAdjustment,
      eyeDistanceAdjustment,
      noseWidthAdjustment,
      noseHeightAdjustment,
      // chinWidthAdjustment,
      chinHeightAdjustment,
    } = result;
    faceWarper.setParameters({
      foreheadHeightAdjustment: foreheadHeightAdjustment as number,
      eyeDistanceAdjustment: eyeDistanceAdjustment as number,
      noseWidthAdjustment: noseWidthAdjustment as number,
      noseHeightAdjustment: noseHeightAdjustment as number,
      // chinWidthAdjustment: chinWidthAdjustment as number,
      chinHeightAdjustment: chinHeightAdjustment as number,
    });
    setSummary(
      [
        foreheadHeightAdjustment
          ? `Forehead height: ${Math.round(foreheadHeightAdjustment)}%`
          : "",
        eyeDistanceAdjustment
          ? `Eye distance: ${Math.round(eyeDistanceAdjustment)}%`
          : "",
        noseWidthAdjustment
          ? `Nose width: ${Math.round(noseWidthAdjustment)}%`
          : "",
        noseHeightAdjustment
          ? `Nose height: ${Math.round(noseHeightAdjustment)}%`
          : "",
        // `Chin width: ${Math.round(chinWidthAdjustment)}%`: '',
        chinHeightAdjustment
          ? `Chin height: ${Math.round(chinHeightAdjustment)}%`
          : "",
      ]
        .filter((r) => r !== "")
        .join("<br/>")
    );
    // Clear the result canvas first
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

    const imageData = faceWarper.applyWarping(ctx);
    if (imageData) {
      resultCtx.putImageData(imageData, 0, 0);
      console.log("Successfully drew optimized image to result canvas");
    }

    setOptimizedImageData(imageData);
  }, [capturedImage, landmarks.length, originalImageData]);

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Kết nối video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current!.play().catch((err) => {
          console.error("[PersonalColor] Error playing video:", err);
        });
        setIsVideoReady(true);
        setIsLoading(false);
        setStatusMessage("Please keep your face steady for analysis");
        setProgress(20);
      };
    }
  }, [stream, setIsLoading]);

  useEffect(() => {
    if (!stream || !canvasRef.current) {
      console.log("[PersonalColor] Waiting for FaceLandmarker or webcam...");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Failed to initialize canvas.");
      return;
    }

    const detect = async () => {
      try {
        const now = performance.now();
        if (now - lastDetectTime.current < 1000 / 60) {
          animationFrameId.current = requestAnimationFrame(detect);
          return;
        }
        lastDetectTime.current = now;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const canvasRatio = canvas.width / canvas.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (image) {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          drawCalculatedRatios(ctx);
          if (capturedImage) {
            drawFacialFeaturePoints(canvas);
          }
          if (!originalImageData) {
            setOriginalImageData(
              ctx.getImageData(0, 0, canvas.width, canvas.height)
            );
          }
        } else if (video) {
          const videoRatio = video.videoWidth / video.videoHeight;
          if (videoRatio > canvasRatio) {
            drawHeight = canvas.width / videoRatio;
            offsetY = (canvas.height - drawHeight) / 2;
          } else {
            drawWidth = canvas.height * videoRatio;
            offsetX = (canvas.width - drawWidth) / 2;
          }
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        }

        if (
          detectionResults?.face?.faceLandmarks &&
          detectionResults?.face?.faceLandmarks.length > 0
        ) {
          const landmarks = detectionResults?.face?.faceLandmarks[0];
          checkFrameStability(landmarks);

          // Draw instructions on canvas when frame is stable
          if (isFrameStable && !capturedImage && !analyzedResult) {
            drawInstructions(ctx, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        console.error("[CosmeticSurgery] Error during face detection:", err);
      }

      animationFrameId.current = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [
    stream,
    isVideoReady,
    detectionResults,
    isFrameStable,
    countdownActive,
    countdownValue,
    optimizedImageData,
    capturedImage,
    optimizedCanvasRef,
  ]);

  // Start the 3-second countdown
  const startCountdown = useCallback(() => {
    setCountdownActive(true);
    setCountdownValue(3);
    countdownStartTimeRef.current = Date.now();

    // Clear any existing timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Set up the countdown timer
    countdownTimerRef.current = setInterval(() => {
      const elapsedTime = Math.floor(
        (Date.now() - (countdownStartTimeRef.current || 0)) / 1000
      );
      const newValue = 3 - elapsedTime;

      if (newValue <= 0) {
        // Countdown finished, capture the image
        captureImage();
        clearInterval(countdownTimerRef.current!);
      } else {
        setCountdownValue(newValue);
      }
    }, 200); // Update more frequently for smoother countdown
  }, []);

  // Reset the countdown
  const resetCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownActive(false);
    setCountdownValue(3);
    countdownStartTimeRef.current = null;
  }, []);

  // Capture an image from the current video frame
  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const worker = new Worker(
      new URL("../worker/ImageFaceDetectorWorker.ts", import.meta.url)
    );
    worker.postMessage({ type: "init" });

    if (!ctx) return;

    // Draw the current video frame to the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Get the image data URL
    const imageDataURL = canvas.toDataURL("image/jpeg");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    worker.onmessage = (e) => {
      const { type, data } = e.data;
      console.log("Worker message:", type, data);
      if (type === "results") {
        console.log("Detection results:", data);

        console.log("Set landmarks:", data.faceLandmarks[0]);
        setCapturedImage(imageDataURL);
        setLandmarks(data.faceLandmarks[0]);
        setProgress(100);
      } else if (type === "initialized") {
        worker.postMessage({
          type: "detect",
          imageData,
        });
      } else if (type === "error") {
        console.error("Error from worker:", data);
        setError(data.message);
      }
    };
    // setLandmarks(detectionResults.face?.faceLandmarks[0] || []);
    // Update status message
  }, [resetCountdown, detectionResults.face]);

  useEffect(() => {
    if (capturedImage) {
      const image = new Image();
      image.src = capturedImage;
      image.onload = () => {
        setImage(image);
        setProgress(100);
        setStatusMessage("Image captured successfully!");
      };
    }
  }, [capturedImage]);

  // Draw instructions on the canvas
  const drawInstructions = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Clear the canvas first
      ctx.clearRect(0, 0, width, height);

      // Draw face outline guide
      const faceSize = Math.min(width, height) * 0.4;

      // Create a path for the entire canvas
      ctx.beginPath();
      ctx.rect(0, 0, width, height);

      // Create a cutout for the ellipse (face area)
      ctx.beginPath();
      // First create the outer rectangle (entire canvas)
      ctx.rect(0, 0, width, height);
      // Then create the ellipse cutout
      ctx.ellipse(
        width / 2,
        height / 2,
        faceSize / 1.5,
        faceSize / 1.2,
        0,
        0,
        Math.PI * 2
      );
      // Use "evenodd" fill rule to create the cutout effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fill("evenodd");

      // Draw the ellipse outline
      ctx.strokeStyle = "rgba(76, 175, 80, 1)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.setLineDash([10, 5]);
      ctx.ellipse(
        width / 2,
        height / 2,
        faceSize / 1.5,
        faceSize / 1.2,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Text styling
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Main instruction
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("Look straight at the camera", width / 2, height - 80);
      ctx.fillText("Don't blink or move", width / 2, height - 40);

      // Countdown display
      if (countdownActive) {
        ctx.font = "bold 72px Arial";
        ctx.fillStyle = "rgba(255, 64, 129, 0.5)"; // Pink color with 0.5 opacity
        ctx.fillText(countdownValue.toString(), width / 2, height / 2 + 80);
      }
    },
    [countdownActive, countdownValue]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (!detectionResults || !detectionResults.face?.faceLandmarks) {
        setNoFaceDetectedDuration((prev) => prev + 1000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [detectionResults]);

  function drawFacialFeaturePoints(originalCanvas: HTMLCanvasElement) {
    const topPoint = () => {
      const midpoint = {
        x: (landmarks[105].x + landmarks[334].x) / 2,
        y: (landmarks[105].y + landmarks[334].y) / 2,
      };
      return {
        x: 2 * landmarks[10].x - midpoint.x,
        y: 2 * landmarks[10].y - midpoint.y,
      };
    };
    const originalCtx = originalCanvas.getContext("2d");
    if (!originalCanvas || !originalCtx) return;

    // Define landmark indices for different facial features
    const features = {
      // chin: [152, 175, 199, 200, 201, 208, 428, 429, 430, 431, 432, 433, 434],
      // cheeks: [
      //   117, 118, 119, 120, 121, 347, 348, 349, 350, 351, 123, 147, 187, 207,
      //   127, 162, 354, 376, 433,
      // ],
      nose: [48, 278, 2, 9],
      // nostrils: [
      //   79, 166, 75, 77, 90, 180, 62, 78, 215, 305, 290, 392, 308, 415, 324,
      //   405,
      // ],
      mouth: [61, 291],
      faceOval: [234, 454, 152],
      // faceOvalPoints: [topPoint(), landmarks[10], landmarks[234], landmarks[454]],
    };

    // Draw different features with different colors
    const featureColors: { [key: string]: string } = {
      chin: "#FF0000",
      cheeks: "#00FF00",
      nose: "#0000FF",
      mouth: "#FF00FF",
      // noseBridge: "#00FFFF",
      faceOval: "#00FFFF",
    };

    // Draw points for each feature
    for (const [feature, indices] of Object.entries(features)) {
      originalCtx.fillStyle = featureColors[feature];

      for (const idx of indices) {
        const x = landmarks[idx].x * originalCanvas.width;
        const y = landmarks[idx].y * originalCanvas.height;
        originalCtx.beginPath();
        originalCtx.arc(x, y, 2, 0, 2 * Math.PI);
        originalCtx.fill();
        originalCtx.closePath();
      }
    }
  }

  // Draw calculated facial ratios overlay
  function drawCalculatedRatios(ctx: CanvasRenderingContext2D | null) {
    if (!ctx || !analyzedResult) return;
    const {
      faceWidth,
      noseWidth,
      mouthWidth,
      eyeWidth,
      eyeDistance,
      faceHeight,
      noseHeight,
      foreheadHeight,
      chinHeight,
      noseWidthPerFaceWidth,
      eyeDistancePerEyeWidth,
      faceHeightPerFaceWidth,
      noseHeightPerFaceHeight,
      foreheadHeightPerFaceHeight,
      chinHeightPerFaceHeight,
    } = analyzedResult;
    // const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.beginPath();
    ctx.scale(0.8, 0.8);
    ctx.rect(0, 0, 300, 300);
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fill();
    ctx.font = "14px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.textRendering = "geometricPrecision";
    ctx.fillText("SIZE:", 10, 20);
    ctx.fillText(`Face  width: ${faceWidth.toFixed(3)}`, 10, 35);
    ctx.fillText(`Nose width: ${noseWidth.toFixed(3)}`, 10, 50);
    ctx.fillText(`Mouth width: ${mouthWidth.toFixed(3)}`, 10, 65);
    ctx.fillText(`Eye width: ${eyeWidth.toFixed(3)}`, 10, 80);
    ctx.fillText(`Eye distance: ${eyeDistance.toFixed(3)}`, 10, 95);
    ctx.fillText(`Face height: ${faceHeight.toFixed(3)}`, 10, 110);
    ctx.fillText(`Nose height: ${noseHeight.toFixed(3)}`, 10, 125);
    ctx.fillText(`Forehead height: ${foreheadHeight.toFixed(3)}`, 10, 140);
    ctx.fillText(`Chin height: ${chinHeight.toFixed(3)}`, 10, 155);
    ctx.fillText("-----------------------------------", 10, 170);
    ctx.fillText("ACTUAL RATIO (IDEAL RATIO):", 10, 185);
    ctx.fillText(
      `Nose/Face width ratio: ${noseWidthPerFaceWidth.toFixed(3)} (${
        IDEAL_RATIOS.noseWidthPerFaceWidth
      })`,
      10,
      200
    );
    ctx.fillText(
      `Eye distance/width ratio: ${eyeDistancePerEyeWidth.toFixed(3)} (${
        IDEAL_RATIOS.eyeDistancePerEyeWidth
      })`,
      10,
      215
    );
    ctx.fillText(
      `Face height/width ratio: ${faceHeightPerFaceWidth.toFixed(3)} (${
        IDEAL_RATIOS.faceHeightPerFaceWidth
      })`,
      10,
      230
    );
    ctx.fillText(
      `Nose/Face height ratio: ${noseHeightPerFaceHeight.toFixed(3)}( ${
        IDEAL_RATIOS.noseHeightPerFaceHeight
      })`,
      10,
      245
    );
    ctx.fillText(
      `Forehead/Face height ratio: ${foreheadHeightPerFaceHeight.toFixed(3)} (${
        IDEAL_RATIOS.foreheadHeightPerFaceHeight
      })`,
      10,
      260
    );
    ctx.fillText(
      `Chin/Face height ratio: ${chinHeightPerFaceHeight.toFixed(3)} (${
        IDEAL_RATIOS.chinHeightPerFaceHeight
      })`,
      10,
      275
    );
    // ctx.fillText("-----------------------------------", 10, 290);
    ctx.closePath();
    ctx.restore();
  }

  return (
    <>
      <AnalysisLayout
        title="Cosmetic Surgery"
        description="Analyze facial features for cosmetic surgery recommendations."
        videoRef={videoRef}
        canvasRef={canvasRef}
        result={sumary}
        error={error || webcamError}
        statusMessage={statusMessage}
        progress={progress}
        detectionResults={detectionResults}
        countdownActive={countdownActive}
        countdownValue={countdownValue}
        capturedImage={capturedImage}
        resultCanvasRef={resultCanvasRef}
        optimizedImageData={optimizedImageData}
      />
    </>
  );
}
