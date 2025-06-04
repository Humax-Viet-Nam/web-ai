import { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { RefObject } from "react";

type Point = { x: number; y: number; z?: number };

/**
 * Tính khoảng cách vuông góc từ 1 điểm đến đường thẳng nối từ A đến B
 */
function perpendicularDistance(
  point: Point,
  lineA: Point,
  lineB: Point
): number {
  const num = Math.abs(
    (lineB.y - lineA.y) * point.x -
      (lineB.x - lineA.x) * point.y +
      lineB.x * lineA.y -
      lineB.y * lineA.x
  );
  const den = Math.sqrt((lineB.y - lineA.y) ** 2 + (lineB.x - lineA.x) ** 2);
  return num / den;
}
export const symmetricPairs: [number, number][] = [
  [33, 263], // mắt ngoài
  [133, 362], // mắt trong
  [36, 266], // dưới mắt
  [78, 308], // khóe miệng
  [61, 291], // môi trên
  [146, 375], // trên má
  [234, 454], // gần tai
  [50, 280], // giữa má
  [205, 425], // gần cằm
];
/**
 * Trả về tỉ lệ đối xứng (0: không đối xứng, 1: hoàn hảo)
 */
export function calculateFaceSymmetry(landmarks: Point[]): number {
  if (landmarks.length < 468) return 0;

  // Trung tuyến mặt: từ cằm (152) đến trán (10)
  const chin = landmarks[152];
  const forehead = landmarks[10];

  // Các cặp đối xứng: [trái, phải]

  let totalDiff = 0;
  for (const [leftIdx, rightIdx] of symmetricPairs) {
    const leftDist = perpendicularDistance(landmarks[leftIdx], chin, forehead);
    const rightDist = perpendicularDistance(
      landmarks[rightIdx],
      chin,
      forehead
    );
    totalDiff += Math.abs(leftDist - rightDist);
  }

  const normalizedScore = Math.max(
    0,
    1 - totalDiff / symmetricPairs.length / 0.03
  ); // 0.03 là ngưỡng điều chỉnh
  return parseFloat(normalizedScore.toFixed(2)); // làm tròn
}

function getColorByDiff(diff: number): string {
  // diff từ 0 đến ~0.05, màu từ xanh → đỏ
  const intensity = Math.min(1, diff / 0.03); // normalize
  const r = Math.floor(255 * intensity);
  const g = Math.floor(255 * (1 - intensity));
  return `rgba(${r},${g},0,0.6)`;
}

export const drawFaceHeatMap = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  landmarks: NormalizedLandmark[]
) => {
  if (landmarks.length < 468) return;
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  // ctx.clearRect(0, 0, width, height);
  const chin = landmarks[152];
  const forehead = landmarks[10];

  for (const [leftIdx, rightIdx] of symmetricPairs) {
    const left = landmarks[leftIdx];
    const right = landmarks[rightIdx];
    const leftDist = perpendicularDistance(left, chin, forehead);
    const rightDist = perpendicularDistance(right, chin, forehead);
    const diff = Math.abs(leftDist - rightDist);
    const color = getColorByDiff(diff);

    // Vẽ hình tròn lên mỗi điểm trái/phải
    [left, right].forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }
};
