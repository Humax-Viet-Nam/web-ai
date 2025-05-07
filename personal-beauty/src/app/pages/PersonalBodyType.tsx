"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import AnalysisLayout from "../components/AnalysisLayout";
import { useWebcam } from "../context/WebcamContext";
import { useLoading } from "../context/LoadingContext";
import { VIEWS } from "../constants/views";
import { DrawingUtils } from "@mediapipe/tasks-vision";

export default function PersonalBody() {
    const {
        stream,
        error: webcamError,
        restartStream,
        detectionResults,
        setCurrentView,
    } = useWebcam();
    const { setIsLoading } = useLoading();
    const [error, setError] = useState<string | null>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>(
        "Initializing camera..."
    );
    const [progress, setProgress] = useState<number>(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const displayVideoRef = useRef<HTMLVideoElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const lastDrawTime = useRef(0);
    const [bodySuggestion, setBodySuggestion] = useState<any | null>(null);

    useEffect(() => {
        setCurrentView(VIEWS.PERSONAL_BODY_TYPE);
    }, []);

    useEffect(() => {
        if (stream && displayVideoRef.current) {
            displayVideoRef.current.srcObject = stream;
            displayVideoRef.current.onloadedmetadata = () => {
                displayVideoRef.current!.play().catch((err) => {
                    console.error("[PersonalBody] Error playing video:", err);
                });
                setIsVideoReady(true);
                setIsLoading(false);
                setStatusMessage("Please keep your body steady for analysis");
                setProgress(20);
            };
        }
    }, [stream, setIsLoading]);

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
            suggestions.push(
                "Bạn có kiểu cơ thể đồng hồ cát, nên chọn váy ôm sát hoặc có thắt eo để tôn dáng và làm nổi bật vòng eo quyến rũ."
            );
        } else if (Math.abs(shoulderWidth - handWidth) < 0.02) {
            suggestions.push(
                "Bạn có kiểu cơ thể hình chữ nhật, hãy chọn trang phục có điểm nhấn ở eo như váy peplum hoặc áo có chiết eo để tạo đường cong mềm mại."
            );
        } else if (ratio > 1.1) {
            suggestions.push(
                "Bạn có kiểu cơ thể tam giác ngược, nên chọn chân váy xòe hoặc quần ống rộng để cân đối với phần vai rộng."
            );
        } else if (ratio < 0.9) {
            suggestions.push(
                "Bạn có kiểu cơ thể tam giác xuôi, hãy chọn áo sáng màu hoặc áo có chi tiết nổi bật để thu hút sự chú ý lên phần thân trên."
            );
        } else if (
            hipWidth > shoulderWidth + 0.05 &&
            Math.abs(waistWidth - hipWidth) < 0.05
        ) {
            suggestions.push(
                "Bạn có kiểu cơ thể quả lê, nên chọn trang phục làm nổi bật phần vai như áo cổ rộng, tay phồng để cân đối với phần hông."
            );
        } else if (
            waistWidth > shoulderWidth + 0.05 &&
            waistWidth > hipWidth + 0.05
        ) {
            suggestions.push(
                "Bạn có kiểu cơ thể quả táo, nên chọn trang phục suông nhẹ, tránh nhấn vào vòng eo và ưu tiên kiểu dáng tạo cảm giác thon gọn."
            );
        } else {
            suggestions.push("Khó xác định dáng cụ thể");
        }

        if (legRatio > 0.55) {
            suggestions.push("Tỷ lệ cơ thể chân dài");
        } else if (legRatio < 0.45) {
            suggestions.push("Tỷ lệ cơ thể chân ngắn");
        } else {
            suggestions.push("Tỷ lệ cơ thể cân đối");
        }

        return suggestions.join(`<br/>`);
    }

    useEffect(() => {
        if (
            !stream ||
            !canvasRef.current ||
            !displayVideoRef.current ||
            !isVideoReady
        ) {
            console.log(
                "[PersonalBody] Waiting for PoseLandmarker or webcam..."
            );
            return;
        }

        const video = displayVideoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            setError("Failed to initialize canvas.");
            return;
        }

        const drawingUtils = new DrawingUtils(ctx);

        let drawWidth: number,
            drawHeight: number,
            offsetX: number,
            offsetY: number;

        const draw = async () => {
            const now = performance.now();
            if (now - lastDrawTime.current < 1000 / 60) {
                // Giới hạn 60 FPS
                animationFrameId.current = requestAnimationFrame(draw);
                return;
            }
            lastDrawTime.current = now;

            // Cập nhật thời gian cho hiệu ứng nhấp nháy
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const videoAspect = video.videoWidth / video.videoHeight;
            const canvasAspect = canvas.width / canvas.height;
            if (videoAspect > canvasAspect) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / videoAspect;
                offsetX = 0;
                offsetY = (canvas.height - drawHeight) / 2;
            } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * videoAspect;
                offsetX = (canvas.width - drawWidth) / 2;
                offsetY = 0;
            }

            let lastVideoTime = -1;
            if (lastVideoTime !== video.currentTime && detectionResults.pose) {
                lastVideoTime = video.currentTime;

                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (const landmark of detectionResults.pose.landmarks) {
                    drawingUtils.drawLandmarks(landmark, {
                        radius: (data) =>
                            DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
                    });
                    drawingUtils.drawConnectors(
                        landmark,
                        detectionResults.pose.POSE_CONNECTIONS
                    );
                }
                ctx.restore();
            }

            setStatusMessage("success");

            if (detectionResults.pose && detectionResults.pose.landmarks) {
                const landmarks = detectionResults.pose.landmarks[0];
                setBodySuggestion(analyzeBodyShape(landmarks));
                setProgress(100);
            }

            animationFrameId.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [stream, isVideoReady, detectionResults]);

    return (
        <AnalysisLayout
            title="Personal body"
            description="Analyze your personal body using live video."
            videoRef={displayVideoRef}
            canvasRef={canvasRef}
            result={bodySuggestion}
            error={error || webcamError}
            detectionResults={detectionResults}
            statusMessage={statusMessage}
            progress={progress}
        />
    );
}
