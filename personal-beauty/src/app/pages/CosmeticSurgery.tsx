/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/display-name */
// src/components/page/CosmeticSurgery.tsx

"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import AnalysisLayout from "../components/AnalysisLayout";
import { useWebcam } from "../context/WebcamContext";
import { useLoading } from "../context/LoadingContext";
import { VIEWS } from "../constants/views";

import { calculateFaceSymmetry, drawFaceHeatMap } from "../libs/faceSymmetry";
import { drawInstructions } from "../libs/faceDetector";
import { SelectionButton } from "../components/SelectionButton";
import {
  calculateFaceGoldenRatio,
  drawCalculatedRatios,
  IDEAL_RATIOS,
} from "../libs/faceGoldenRatioDetector";
import { FaceWarpingControllers } from "../components/FaceWarperController";
import { FaceWarper, WarpingParameters } from "../libs/faceWarper";

export default function CosmeticSurgery() {
  const {
    stream,
    error: webcamError,
    detectionResults,
    setCurrentView,
    countdownActive,
    countdownValue,
    capturedImage,
    capturedLandmarks,
    startCountdown,
    resetCountdown,
    resetCapturedImage,
    countdownTimerRef,
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
  const animationFrameId = useRef<number | null>(null);
  const lastDetectTime = useRef(0);
  const [selectedArea, setSelectedArea] = useState<string | null>(
    "face_symmetry"
  );
  // guideLine state
  const [guideLine, setGuideLine] = useState<string>("");
  const [faceWarpingValues, setFaceWarpingValues] = useState<WarpingParameters>(
    {
      noseWidthAdjustment: 0,
      eyeDistanceAdjustment: 0,
      foreheadHeightAdjustment: 0,
      chinHeightAdjustment: 0,
      noseHeightAdjustment: 0,
    }
  );

  const [sumaryResult, setSummaryResult] = useState<string | null>(null);
  const controlAreas = [
    {
      name: "face_symmetry",
      label: "Face Symmetry",
    },
    {
      name: "golden_ratio",
      label: "Golden Ratio",
    },
    {
      name: "adjust_face",
      label: "Adjust Face",
    },
  ];

  useEffect(() => {
    setCurrentView(VIEWS.COSMETIC_SURGERY);
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
          startCountdown(canvasRef);
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

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      resetCapturedImage();
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
        if (capturedImage) return;

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

        if (video) {
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
          if (isFrameStable && !capturedImage) {
            drawInstructions(
              ctx,
              countdownActive,
              countdownValue,
              canvas.width,
              canvas.height
            );
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
    capturedImage,
    faceWarpingValues,
  ]);

  const analysisFaceSymmetry = useCallback(() => {
    const faceSymetryResult = calculateFaceSymmetry(capturedLandmarks);
    const diff = 1 - faceSymetryResult; // Chuyển đổi về độ lệch
    if (diff <= 0.3) {
      setSummaryResult("Face symmetry is good.");
    } else if (diff > 0.3 && diff <= 0.6) {
      setSummaryResult("Face symmetry is acceptable.");
    } else if (diff > 0.6) {
      setSummaryResult("Face symmetry needs improvement.");
    }
  }, [capturedLandmarks]);

  const analysisGoldenRatio = useCallback(() => {
    if (!capturedLandmarks || capturedLandmarks.length < 468) return;
    const analyzedResult = calculateFaceGoldenRatio(capturedLandmarks);
    drawCalculatedRatios(canvasRef, analyzedResult);
    setSummaryResult(
      [
        `Nose/Face width ratio: ${analyzedResult.noseWidthPerFaceWidth.toFixed(
          3
        )} (${IDEAL_RATIOS.noseWidthPerFaceWidth})`,
        `Eye distance/width ratio: ${analyzedResult.eyeDistancePerEyeWidth.toFixed(
          3
        )} (${IDEAL_RATIOS.eyeDistancePerEyeWidth})`,
        `Face height/width ratio: ${analyzedResult.faceHeightPerFaceWidth.toFixed(
          3
        )} (${IDEAL_RATIOS.faceHeightPerFaceWidth})`,
        `Nose/Face height ratio: ${analyzedResult.noseHeightPerFaceHeight.toFixed(
          3
        )} (${IDEAL_RATIOS.noseHeightPerFaceHeight})`,
        `Forehead/Face height ratio: ${analyzedResult.foreheadHeightPerFaceHeight.toFixed(
          3
        )} (${IDEAL_RATIOS.foreheadHeightPerFaceHeight})`,
        `Chin/Face height ratio: ${analyzedResult.chinHeightPerFaceHeight.toFixed(
          3
        )} (${IDEAL_RATIOS.chinHeightPerFaceHeight})`,
      ].join("<br/>")
    );
  }, [capturedLandmarks]);

  const adjustFace = useCallback(() => {
    if (!capturedLandmarks || !capturedLandmarks.length || !canvasRef.current || !capturedImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Failed to initialize canvas context.");
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    const faceWarper = new FaceWarper(capturedLandmarks, width, height);
    faceWarper.setOriginalImageData(capturedImage);
    faceWarper.setParameters(faceWarpingValues as WarpingParameters);
    const imageData = faceWarper.applyWarping(ctx);
    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }
  }, [capturedImage, capturedLandmarks, faceWarpingValues]);

  // Only run adjustFace when its dependencies change, not every animation frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !capturedImage || !selectedArea || !capturedLandmarks || !capturedLandmarks.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    switch (selectedArea) {
      case "golden_ratio":
        ctx.putImageData(capturedImage, 0, 0);
        analysisGoldenRatio();
        break;
      case "adjust_face":
        adjustFace();
        break;
      default:
      case "face_symmetry":
        ctx.putImageData(capturedImage, 0, 0);
        analysisFaceSymmetry();
        drawFaceHeatMap(canvasRef, capturedLandmarks);
        break;
    }
  }, [capturedImage, selectedArea, faceWarpingValues, analysisFaceSymmetry, analysisGoldenRatio, adjustFace, capturedLandmarks]);

  // Capture an image from the current video frame
  const selectionButtons = useMemo(
    () => (
      <div className="md:w-2/12 p-1 rounded-xl flex flex-col max-h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex flex-col flex-wrap gap-3 w-full h-full">
          <div className="flex flex-col gap-6">
            {controlAreas.map((area) => (
              <SelectionButton
                key={area.name}
                area={area.name}
                label={area.label}
                selectedArea={selectedArea}
                setSelectedArea={setSelectedArea}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    [selectedArea, setSelectedArea]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (!detectionResults || !detectionResults.face?.faceLandmarks) {
        setNoFaceDetectedDuration((prev) => prev + 1000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [detectionResults]);
  useEffect(() => {
    if (selectedArea === "face_symmetry") {
      setGuideLine(
        "Analyze face symmetry by comparing left and right sides of the face."
      );
    } else if (selectedArea === "golden_ratio") {
      setGuideLine(
        "Analyze face golden ratio by calculating various facial ratios."
      );
    } else {
      setGuideLine(
        "Adjust face parameters to modify the face shape. Use the controls to change the parameters."
      );
    }
  }, [selectedArea])
  return (
    <>
      <AnalysisLayout
        title="Cosmetic Surgery"
        description={guideLine}
        videoRef={videoRef}
        canvasRef={canvasRef}
        result={sumaryResult}
        disableResult={selectedArea === "adjust_face"}
        error={error || webcamError}
        statusMessage={statusMessage}
        controllers={
          (capturedImage && selectedArea === "adjust_face" && (
            <FaceWarpingControllers
              faceWarpingValues={faceWarpingValues}
              setFaceWarpingValues={setFaceWarpingValues}
            />
          )) ||
          undefined
        }
        progress={progress}
        detectionResults={detectionResults}
        countdownActive={countdownActive}
        countdownValue={countdownValue}
        capturedImage={capturedImage}
        selectionButtons={(capturedImage && selectionButtons) || undefined}
      />
    </>
  );
}
