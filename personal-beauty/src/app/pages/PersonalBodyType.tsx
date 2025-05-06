/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/PersonalColor.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
    DrawingUtils,
    FilesetResolver,
    PoseLandmarker,
} from "@mediapipe/tasks-vision";
import AnalysisLayout from "../components/AnalysisLayout";
import { useWebcam } from "../context/WebcamContext";
import { useLoading } from "../context/LoadingContext"; // Thêm import
import { useHandControl } from "../context/HandControlContext";

export default function PersonalColor() {
    const { stream, error: webcamError, restartStream } = useWebcam();
    const { setIsLoading } = useLoading(); // Sử dụng context
    const { registerElement, unregisterElement } = useHandControl();
    const [error, setError] = useState<string | null>(null);
    const [isPoseLandmarkerReady, setIsPoseLandmarkerReady] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [isFaceDetectionActive, setIsFaceDetectionActive] = useState(true); // Thêm trạng thái chế độ
    const [statusMessage, setStatusMessage] = useState("Face Detection Active"); // Thêm thông báo trạng thái
    const [twoFingersProgress, setTwoFingersProgress] = useState(0); // Thêm tiến trình giơ 2 ngón tay
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const displayVideoRef = useRef<HTMLVideoElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const [bodySuggestion, setBodySuggestion] = useState<any | null>(null);
    const lastDetectTime = useRef(0);

    useEffect(() => {
        const initializePoseLandmarker = async () => {
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
                );
                const poseLandmarker: PoseLandmarker =
                    await PoseLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                            delegate: "GPU",
                        },
                        runningMode: "VIDEO",
                        numPoses: 1,
                        minPoseDetectionConfidence: 0.9,
                        minPosePresenceConfidence: 0.9,
                        minTrackingConfidence: 0.9,
                    });

                poseLandmarkerRef.current = poseLandmarker;
                setIsPoseLandmarkerReady(true);
            } catch (err) {
                console.error(
                    "[PersonalColor] Error initializing FaceLandmarker:",
                    err
                );
                setError("Failed to initialize face detection.");
            }
        };

        initializePoseLandmarker();

        return () => {
            if (poseLandmarkerRef.current) {
                poseLandmarkerRef.current.close();
                poseLandmarkerRef.current = null;
            }
            setIsPoseLandmarkerReady(false);
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, []);

    type Landmark = { x: number; y: number; z?: number };

    function distance(a: Landmark, b: Landmark): number {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    function getClosestLandmarkOnY(
        landmarks: Landmark[],
        targetY: number,
        side: "left" | "right"
    ): Landmark {
        // Lọc điểm theo bên trái hoặc phải
        const sideLandmarks = landmarks.filter((_, index) => {
            if (side === "left")
                return [11, 13, 15, 23, 25, 27].includes(index);
            else return [12, 14, 16, 24, 26, 28].includes(index);
        });

        // Tìm điểm có Y gần nhất với targetY
        return sideLandmarks.reduce((closest, landmark) =>
            Math.abs(landmark.y - targetY) < Math.abs(closest.y - targetY)
                ? landmark
                : closest
        );
    }

    function analyzeBodyShape(landmarks: Landmark[]): string {
        if (landmarks.length < 33) return "Không đủ dữ liệu";

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftHand = landmarks[15];
        const rightHand = landmarks[16];
        const head = landmarks[0];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];

        const shoulderWidth = distance(leftShoulder, rightShoulder);
        const hipWidth = distance(leftHip, rightHip);
        const handWidth = distance(leftHand, rightHand);
        const bodyHeight = distance(head, {
            x: (leftAnkle.x + rightAnkle.x) / 2,
            y: (leftAnkle.y + rightAnkle.y) / 2,
            z: 0,
        });
        const legLength = distance(
            {
                x: (leftHip.x + rightHip.x) / 2,
                y: (leftHip.y + rightHip.y) / 2,
                z: 0,
            },
            {
                x: (leftAnkle.x + rightAnkle.x) / 2,
                y: (leftAnkle.y + rightAnkle.y) / 2,
                z: 0,
            }
        );

        const ratio = shoulderWidth / handWidth;
        const legRatio = legLength / bodyHeight;

        const suggestions = [];

        const waistY =
            (leftShoulder.y + leftHip.y + rightShoulder.y + rightHip.y) / 4;

        // Lấy điểm bên trái/phải gần eo nhất
        const leftWaist = getClosestLandmarkOnY(landmarks, waistY, "left");
        const rightWaist = getClosestLandmarkOnY(landmarks, waistY, "right");

        // Tính khoảng cách eo thực tế
        const waistWidth = Math.abs(rightWaist.x - leftWaist.x);

        if (
            Math.abs(shoulderWidth - hipWidth) < 0.05 &&
            Math.abs(waistWidth - shoulderWidth) > 0.1
        ) {
            suggestions.push("Dáng đồng hồ cát");
        } else if (Math.abs(shoulderWidth - handWidth) < 0.02) {
            suggestions.push("Dáng cân đối (chữ nhật)");
        } else if (ratio > 1.1) {
            suggestions.push("Dáng tam giác ngược");
        } else if (ratio < 0.9) {
            suggestions.push("Dáng tam giác xuôi");
        } else {
            suggestions.push("Khó xác định dáng cụ thể");
        }

        if (legRatio > 0.55) {
            suggestions.push("Chân dài");
        } else if (legRatio < 0.45) {
            suggestions.push("Chân ngắn");
        } else {
            suggestions.push("Tỷ lệ cân đối");
        }

        return suggestions.join("<br/>");
    }

    // function analyzeBodyShape(landmarks: Landmark[]): string {
    //     if (landmarks.length < 25) return "Không đủ dữ liệu để phân tích";
    //     const suggestions: string[] = [];

    //     const leftShoulder = landmarks[11];
    //     const rightShoulder = landmarks[12];
    //     const leftHip = landmarks[23];
    //     const rightHip = landmarks[24];

    //     const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    //     const hipWidth = Math.abs(rightHip.x - leftHip.x);
    //     const waistWidth = ((shoulderWidth + hipWidth) / 2) * 0.8; // Ước lượng eo

    //     // Tỉ lệ để xác định dáng
    //     const ratio = shoulderWidth / hipWidth;

    //     if (
    //         Math.abs(shoulderWidth - hipWidth) < 0.05 &&
    //         Math.abs(waistWidth - shoulderWidth) > 0.1
    //     ) {
    //         suggestions.push(
    //             "Đồng hồ cát - bạn phù hợp với trang phục ôm sát và nhấn eo"
    //         );
    //     } else if (ratio > 1.1) {
    //         suggestions.push(
    //             "Tam giác ngược - nên chọn trang phục làm nổi bật phần thân dưới"
    //         );
    //     } else if (ratio < 0.9) {
    //         suggestions.push(
    //             "Tam giác xuôi - nên làm nổi bật phần thân trên, dùng áo vai phồng"
    //         );
    //     } else {
    //         suggestions.push("Chữ nhật - nên chọn đồ tạo đường cong, thắt eo");
    //     }

    //     const headY = landmarks[0].y;
    //     const hipY = (landmarks[23].y + landmarks[24].y) / 2;
    //     const ankleY = (landmarks[27].y + landmarks[28].y) / 2;

    //     const bodyHeight = ankleY - headY;
    //     const legLength = ankleY - hipY;
    //     const legRatio = legLength / bodyHeight;

    //     // 1. Gợi ý phong cách tổng thể
    //     if (legRatio > 0.55) {
    //         suggestions.push(
    //             "Bạn có đôi chân dài, phù hợp với váy dài, quần ống rộng hoặc váy xẻ tà."
    //         );
    //     } else if (legRatio < 0.45) {
    //         suggestions.push(
    //             "Chân bạn khá ngắn so với tổng thể, nên chọn quần cạp cao, váy ngắn hoặc giày cao gót để tăng chiều cao thị giác."
    //         );
    //     } else {
    //         suggestions.push(
    //             "Tỷ lệ chân - thân cân đối, bạn có thể linh hoạt lựa chọn đa dạng phong cách."
    //         );
    //     }

    //     if (shoulderWidth > 0.25) {
    //         suggestions.push(
    //             "Vai bạn khá rộng, nên chọn áo cổ vuông, áo trễ vai."
    //         );
    //     } else if (shoulderWidth < 0.15) {
    //         suggestions.push(
    //             "Vai nhỏ, bạn có thể thử áo có cầu vai hoặc tay phồng để tạo cân đối."
    //         );
    //     } else {
    //         suggestions.push("Vai cân đối, dễ phối nhiều kiểu áo.");
    //     }

    //     return suggestions.join("<br/>");
    // }

    // Kết nối video stream
    useEffect(() => {
        if (stream && displayVideoRef.current) {
            displayVideoRef.current.srcObject = stream;
            displayVideoRef.current.play().catch((err) => {
                console.error("[PersonalBody] Error playing video:", err);
            });

            const checkVideoReady = () => {
                if (
                    displayVideoRef.current &&
                    displayVideoRef.current.readyState >= 4
                ) {
                    setIsVideoReady(true);
                    setIsLoading(false); // Tắt loading qua context
                } else {
                    setTimeout(checkVideoReady, 500);
                }
            };

            checkVideoReady();
        }
    }, [stream, setIsLoading]);

    useEffect(() => {
        if (
            !isPoseLandmarkerReady ||
            !stream ||
            !canvasRef.current ||
            !displayVideoRef.current ||
            !isFaceDetectionActive
        ) {
            return;
        }
        const video = displayVideoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            setError("Failed to initialize canvas.");
            return;
        }

        const drawingUtils = new DrawingUtils(ctx);

        const waitForVideoReady = async () => {
            let retries = 5;
            while (retries > 0 && video.readyState < 4) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                retries--;
                if (video.readyState < 4) {
                    await restartStream();
                }
            }
            if (video.readyState < 4) {
                setError("Failed to load webcam video for face detection.");
                return false;
            }
            return true;
        };

        const detect = async () => {
            if (!poseLandmarkerRef.current) {
                animationFrameId.current = requestAnimationFrame(detect);
                return;
            }

            const isVideoReady = await waitForVideoReady();
            if (!isVideoReady) {
                return;
            }

            try {
                const now = performance.now();
                if (now - lastDetectTime.current < 120) {
                    // 10 FPS
                    animationFrameId.current = requestAnimationFrame(detect);
                    return;
                }

                lastDetectTime.current = now;
                // ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const results = poseLandmarkerRef.current.detectForVideo(
                    video,
                    now
                );
                if (results.landmarks && results.landmarks.length > 0) {
                    const landmarks = results.landmarks[0];
                    const suggestion = analyzeBodyShape(landmarks);

                    // Làm sạch canvas trước khi vẽ
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const videoAspect = video.videoWidth / video.videoHeight;
                    const canvasAspect = canvas.width / canvas.height;

                    let drawWidth, drawHeight, offsetX, offsetY;

                    if (videoAspect > canvasAspect) {
                        drawWidth = canvas.width;
                        drawHeight = canvas.width / videoAspect;
                        offsetX = 0;
                        offsetY = (canvas.height - drawHeight) / 2;
                    } else {
                        drawHeight = canvas.height;
                        drawWidth = canvas.height * videoAspect;
                        offsetY = 0;
                        offsetX = (canvas.width - drawWidth) / 2;
                    }

                    ctx.drawImage(
                        video,
                        offsetX,
                        offsetY,
                        drawWidth,
                        drawHeight
                    );

                    let lastVideoTime = -1;
                    let startTimeMs = performance.now();
                    if (lastVideoTime !== video.currentTime) {
                        lastVideoTime = video.currentTime;

                        poseLandmarkerRef.current.detectForVideo(
                            video,
                            startTimeMs,
                            (result) => {
                                ctx.save();
                                ctx.clearRect(
                                    0,
                                    0,
                                    canvas.width,
                                    canvas.height
                                );
                                for (const landmark of result.landmarks) {
                                    drawingUtils.drawLandmarks(landmark, {
                                        radius: (data) =>
                                            DrawingUtils.lerp(
                                                data.from!.z,
                                                -0.15,
                                                0.1,
                                                5,
                                                1
                                            ),
                                    });
                                    drawingUtils.drawConnectors(
                                        landmark,
                                        PoseLandmarker.POSE_CONNECTIONS
                                    );
                                }
                                ctx.restore();
                            }
                        );
                    }

                    setStatusMessage("ok");

                    setBodySuggestion(`${suggestion}`);
                } else {
                    setBodySuggestion(null);
                }
            } catch (err) {
                console.error(
                    "[PersonalMakeup] Error during face mesh detection:",
                    err
                );
            }

            animationFrameId.current = requestAnimationFrame(detect);
        };

        detect();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isPoseLandmarkerReady, stream, restartStream]);

    return (
        <AnalysisLayout
            title="Personal Body"
            description="Analyze your personal body using live video."
            videoRef={displayVideoRef}
            canvasRef={canvasRef}
            result={bodySuggestion}
            error={error || webcamError}
            statusMessage={statusMessage} // Truyền statusMessage
            progress={twoFingersProgress} // Truyền progress
        />
    );
}
