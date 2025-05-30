import { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { RefObject } from "react";

export interface AnalyzedResult {
  noseWidth: number;
  mouthWidth: number;
  faceWidth: number;
  eyeDistance: number;
  eyeWidth: number;
  faceHeight: number;
  noseHeight: number;
  foreheadHeight: number;
  chinHeight: number;
  noseWidthPerFaceWidth: number;
  // mouthWidthPerNoseWidth: number;
  eyeDistancePerEyeWidth: number;
  faceHeightPerFaceWidth: number;
  noseHeightPerFaceHeight: number;
  foreheadHeightPerFaceHeight: number;
  chinHeightPerFaceHeight: number;
}

const GOLDEN_RATIO = 1.612;

export const IDEAL_RATIOS = {
  noseWidthPerFaceWidth: 0.25,
  mouthWidthPerNoseWidth: GOLDEN_RATIO,
  eyeDistancePerEyeWidth: GOLDEN_RATIO,
  faceHeightPerFaceWidth: GOLDEN_RATIO,
  noseHeightPerFaceHeight: 0.33,
  foreheadHeightPerFaceHeight: 0.33,
  chinHeightPerFaceHeight: 0.33,
};
const distance = (p1: NormalizedLandmark, p2: NormalizedLandmark): number => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

const getTopPoint = (landmarks: NormalizedLandmark[]): NormalizedLandmark => {
  const midpoint = {
    x: (landmarks[105].x + landmarks[334].x) / 2,
    y: (landmarks[105].y + landmarks[334].y) / 2,
  };
  return {
    x: 2 * landmarks[10].x - midpoint.x,
    y: 2 * landmarks[10].y - midpoint.y,
  } as NormalizedLandmark;
};

export const calculateFaceGoldenRatio = (
  landmarks: NormalizedLandmark[]
): AnalyzedResult => {
  if (landmarks.length < 468) {
    throw new Error("Insufficient landmarks for analysis");
  }
  const topPoint = getTopPoint(landmarks);
  // 1. Chiều rộng mũi / chiều rộng khuôn mặt
  const noseWidth = distance(landmarks[48], landmarks[278]);
  const faceWidth = distance(landmarks[234], landmarks[454]);
  const noseWidthPerFaceWidth = noseWidth / faceWidth;

  // 2. Chiều rộng miệng / chiều rộng mũi
  const mouthWidth = distance(landmarks[61], landmarks[291]);
  // const mouthWidthPerNoseWidth = mouthWidth / noseWidth;

  // 3. Khoảng cách giữa 2 mắt / trung bình chiều rộng mắt
  const eyeDistance = distance(landmarks[133], landmarks[362]);
  const leftEyeWidth = distance(landmarks[33], landmarks[133]);
  const rightEyeWidth = distance(landmarks[362], landmarks[263]);
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
  const eyeWidth = avgEyeWidth;
  const eyeDistancePerEyeWidth = eyeDistance / avgEyeWidth;

  // 4. Chiều dài khuôn mặt / chiều rộng khuôn mặt
  const faceHeight = distance(topPoint, landmarks[152]);
  const faceHeightPerFaceWidth = faceHeight / faceWidth;

  // 5. Chiều dài mũi / chiều dài khuôn mặt
  // 6. Tỷ lệ trán:mũi:cằm (1:1:1)
  const foreheadHeight = distance(topPoint, landmarks[9]);
  const noseHeight = distance(landmarks[9], landmarks[2]);
  const chinHeight = distance(landmarks[2], landmarks[152]);

  const foreheadHeightPerFaceHeight = foreheadHeight / faceHeight;
  const chinHeightPerFaceHeight = chinHeight / faceHeight;
  const noseHeightPerFaceHeight = noseHeight / faceHeight;

  return {
    noseWidthPerFaceWidth,
    mouthWidth,
    eyeDistancePerEyeWidth,
    faceHeightPerFaceWidth,
    foreheadHeightPerFaceHeight,
    chinHeightPerFaceHeight,
    noseHeightPerFaceHeight,
    eyeWidth,
    chinHeight,
    foreheadHeight,
    noseHeight,
    faceWidth,
    faceHeight,
    noseWidth,
    eyeDistance,
  };
};

// Draw calculated facial ratios overlay
export function drawCalculatedRatios(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  analyzedResult: AnalyzedResult | null
) {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx || !analyzedResult) return;
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


  // ctx.clearRect(0, 0, canvas.width, canvas.height);
  // const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.beginPath();
  ctx.scale(0.8, 0.8);
  ctx.rect(0, 0, 300, 180);
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fill();
  ctx.font = "14px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.textRendering = "geometricPrecision";
  ctx.fillText("SIZE:", 10, 20);
  ctx.fillText(`Face  width:`, 10, 35);
  ctx.fillText(`Nose width:`, 10, 50);
  ctx.fillText(`Mouth width:`, 10, 65);
  ctx.fillText(`Eye width:`, 10, 80);
  ctx.fillText(`Eye distance:`, 10, 95);
  ctx.fillText(`Face height:`, 10, 110);
  ctx.fillText(`Nose height:`, 10, 125);
  ctx.fillText(`Forehead height:`, 10, 140);
  ctx.fillText(`Chin height:`, 10, 155);
  ctx.fillText(`${faceWidth.toFixed(3)}`, 190, 35);
  ctx.fillText(`${noseWidth.toFixed(3)}`, 190, 50);
  ctx.fillText(`${mouthWidth.toFixed(3)}`, 190, 65);
  ctx.fillText(`${eyeWidth.toFixed(3)}`, 190, 80);
  ctx.fillText(`${eyeDistance.toFixed(3)}`, 190, 95);
  ctx.fillText(`${faceHeight.toFixed(3)}`, 190, 110);
  ctx.fillText(`${noseHeight.toFixed(3)}`, 190, 125);
  ctx.fillText(`${foreheadHeight.toFixed(3)}`, 190, 140);
  ctx.fillText(`${chinHeight.toFixed(3)}`, 190, 155);
  ctx.closePath();
  ctx.restore();
}
