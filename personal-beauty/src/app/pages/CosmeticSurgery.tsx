/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/display-name */
// src/components/page/CosmeticSurgery.tsx

"use client"

import { useCallback } from "react"
import { useState, useEffect, useRef } from "react"
import AnalysisLayout from "../components/AnalysisLayout"
import { useWebcam } from "../context/WebcamContext"
import { useLoading } from "../context/LoadingContext"
import { VIEWS } from "../constants/views"

export default function CosmeticSurgery() {
  const { stream, error: webcamError, detectionResults, setCurrentView } = useWebcam()
  const { setIsLoading } = useLoading()
  const [error, setError] = useState<string | null>(null)
  const lastStableTime = useRef<number | null>(null)
  const lastUnstableTime = useRef<number | null>(null)
  const STABILITY_THRESHOLD = 15
  const HISTORY_SIZE = 5
  const STABILITY_DURATION = 1000
  const MIN_STABLE_DURATION = 500
  const [statusMessage, setStatusMessage] = useState<string>("Initializing camera...")
  const [isFrameStable, setIsFrameStable] = useState(false)
  const landmarkHistoryRef = useRef<{ x: number; y: number }[][]>([])
  const [noFaceDetectedDuration, setNoFaceDetectedDuration] = useState<number>(0)
  const [progress, setProgress] = useState<number>(0)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const animationFrameId = useRef<number | null>(null)
  const lastDetectTime = useRef(0)

  // New state for countdown and image capture
  const [countdownActive, setCountdownActive] = useState(false)
  const [countdownValue, setCountdownValue] = useState(3)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownStartTimeRef = useRef<number | null>(null)

  useEffect(() => {
    setCurrentView(VIEWS.COSMETIC_SURGERY)
  }, [])

  const checkFrameStability = useCallback(
    (landmarks: { x: number; y: number }[]) => {
      const newHistory = [...landmarkHistoryRef.current, landmarks].slice(-HISTORY_SIZE)
      if (!detectionResults.face?.faceLandmarks) {
        setNoFaceDetectedDuration((prev) => prev + 1000)
        if (noFaceDetectedDuration >= 30000) {
          setStatusMessage("Face not detected for a long time. Please refresh the camera.")
        } else {
          setStatusMessage("Face not detected. Please adjust your position.")
        }
        setProgress(0)
        setIsFrameStable(false)
        landmarkHistoryRef.current = [] // reset

        // Reset countdown if face is lost
        if (countdownActive) {
          resetCountdown()
        }
        return
      }

      setNoFaceDetectedDuration(0)

      if (newHistory.length < HISTORY_SIZE) {
        setStatusMessage("Collecting face data...")
        setProgress(20)
        
        landmarkHistoryRef.current = newHistory
        return
      }

      let totalDeviation = 0
      let deviationCount = 0

      for (let i = 1; i < newHistory.length; i++) {
        for (let j = 0; j < landmarks.length; j++) {
          const dx = (newHistory[i][j].x - newHistory[i - 1][j].x) * 640
          const dy = (newHistory[i][j].y - newHistory[i - 1][j].y) * 480
          const distance = Math.sqrt(dx * dx + dy * dy)
          totalDeviation += distance
          deviationCount++
        }
      }

      const averageDeviation = deviationCount > 0 ? totalDeviation / deviationCount : 0
      const now = performance.now()
      const isStable = averageDeviation < STABILITY_THRESHOLD

      if (isStable && !lastStableTime.current) {
        lastStableTime.current = now
        setStatusMessage("Analyzing face...")
        setProgress(60)
      } else if (isStable && lastStableTime.current && now - lastStableTime.current >= STABILITY_DURATION) {
        setIsFrameStable(true)

        // Only start countdown if it's not already active
        if (!countdownActive && !capturedImage) {
          startCountdown()
        }
        if (countdownActive) {
          setStatusMessage(`Keep still! Capturing in ${countdownValue}s...`)
        }

        setProgress(100)
        lastUnstableTime.current = null
      } else if (!isStable) {
        if (lastStableTime.current && now - lastStableTime.current < MIN_STABLE_DURATION) {
          landmarkHistoryRef.current = newHistory
          return
        }
        if (!lastUnstableTime.current) {
          lastUnstableTime.current = now
        }
        lastStableTime.current = null
        setIsFrameStable(false)

        // Reset countdown if face becomes unstable during countdown
        if (countdownActive) {
          resetCountdown()
        }

        setStatusMessage("Please keep your face steady for analysis")
        setProgress(20)
      }

      landmarkHistoryRef.current = newHistory
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
    ],
  )

  // Start the 3-second countdown
  const startCountdown = useCallback(() => {
    setCountdownActive(true)
    setCountdownValue(3)
    countdownStartTimeRef.current = Date.now()

    // Clear any existing timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }

    // Set up the countdown timer
    countdownTimerRef.current = setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - (countdownStartTimeRef.current || 0)) / 1000)
      const newValue = 3 - elapsedTime

      if (newValue <= 0) {
        // Countdown finished, capture the image
        captureImage()
        clearInterval(countdownTimerRef.current!)
      } else {
        setCountdownValue(newValue)
      }
    }, 200) // Update more frequently for smoother countdown
  }, [])

  // Reset the countdown
  const resetCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setCountdownActive(false)
    setCountdownValue(3)
    countdownStartTimeRef.current = null
  }, [])

  // Capture an image from the current video frame
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // Draw the current video frame to the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get the image data URL
    const imageDataURL = canvas.toDataURL("image/jpeg")
    setCapturedImage(imageDataURL)

    // Update status message
    setStatusMessage("Image captured successfully!")

    // Reset countdown
    resetCountdown()

    // After 2 seconds, reset everything to start over
    setTimeout(() => {
      setCapturedImage(null)
      setIsFrameStable(false)
      lastStableTime.current = null
    }, 2000)
  }, [resetCountdown])

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  // Kết nối video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = () => {
        videoRef.current!.play().catch((err) => {
          console.error("[PersonalColor] Error playing video:", err)
        })
        setIsVideoReady(true)
        setIsLoading(false)
        setStatusMessage("Please keep your face steady for analysis")
        setProgress(20)
      }
    }
  }, [stream, setIsLoading])

  useEffect(() => {
    if (!stream || !canvasRef.current || !videoRef.current || !isVideoReady) {
      console.log("[PersonalColor] Waiting for FaceLandmarker or webcam...")
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setError("Failed to initialize canvas.")
      return
    }
        
    const detect = async () => {
      try {
        const now = performance.now()
        if (now - lastDetectTime.current < 1000 / 60) {
          animationFrameId.current = requestAnimationFrame(detect)
          return
        }
        lastDetectTime.current = now

        // ctx.clearRect(0, 0, canvas.width, canvas.height)
        const videoRatio = video.videoWidth / video.videoHeight
        const canvasRatio = canvas.width / canvas.height
        let drawWidth = canvas.width
        let drawHeight = canvas.height
        let offsetX = 0
        let offsetY = 0

        if (videoRatio > canvasRatio) {
          drawHeight = canvas.width / videoRatio
          offsetY = (canvas.height - drawHeight) / 2
        } else {
          drawWidth = canvas.height * videoRatio
          offsetX = (canvas.width - drawWidth) / 2
        }
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)

        if (detectionResults?.face?.faceLandmarks && detectionResults?.face?.faceLandmarks.length > 0) {
          const landmarks = detectionResults?.face?.faceLandmarks[0]
          checkFrameStability(landmarks)
          // Draw instructions on canvas when frame is stable
          // Always draw instructions when face is detected, not just during countdown

        }
      } catch (err) {
        console.error("[CosmeticSurgery] Error during face detection:", err)
      }

      animationFrameId.current = requestAnimationFrame(detect)
    }

    detect()

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [stream, isVideoReady, detectionResults, isFrameStable, countdownActive, countdownValue])

  // Draw instructions on the canvas
  const drawInstructions = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Text styling
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Main instruction
    ctx.font = "bold 24px Arial"
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
    ctx.fillText("Look straight at the camera", width / 2, height - 80)
    ctx.fillText("Don't blink or move", width / 2, height - 40)

    // Draw a face outline guide
    ctx.strokeStyle = "white" // Green color
    ctx.lineWidth = 3
    const faceSize = Math.min(width, height) * 0.4
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.ellipse(width / 2, height / 2, faceSize / 1.5, faceSize / 1.2, 0, 0, Math.PI * 2)
    ctx.setLineDash([0, 0]) // Reset line dash
    ctx.stroke()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!detectionResults || !detectionResults.face?.faceLandmarks) {
        setNoFaceDetectedDuration((prev) => prev + 1000)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [detectionResults])

  return (
    <AnalysisLayout
      title="Cosmetic Surgery"
      description="Analyze facial features for cosmetic surgery recommendations."
      videoRef={videoRef}
      canvasRef={canvasRef}
      result={capturedImage ? "Image captured successfully!" : null}
      error={error || webcamError}
      statusMessage={statusMessage}
      progress={progress}
      detectionResults={detectionResults}
    />
  )
}
