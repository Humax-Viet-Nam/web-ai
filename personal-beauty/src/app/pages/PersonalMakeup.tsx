/* eslint-disable react/display-name */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/PersonalMakeup.tsx - Ultra Precise Makeup Component

"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useWebcam } from "../context/WebcamContext";
import { useLoading } from "../context/LoadingContext";
import { useHandControl } from "../context/HandControlContext";
import { VIEWS } from "../constants/views";

// Define makeup categories and styles
type MakeupCategory = "looks" | "lips" | "cheeks";
type LookStyle = "natural" | "smokey" | "cat" | "glitter" | "nude";
type LipStyle = "matte" | "glossy" | "ombre" | "tint" | "nude";
type CheekStyle = "natural" | "contour" | "blush" | "highlight" | "bronzer";

// Định nghĩa tab chọn kiểu và chọn màu
type StyleColorTab = "style" | "color";

// Define makeup properties
interface MakeupProperties {
  color: string;
  brightness: number;
  intensity: number;
  size: number;
  shine: number;
}

// Enhanced Color presets
const lipColors = [
  { name: "Classic Red", color: "rgba(220, 20, 60, 0.7)", value: "#DC143C" },
  { name: "Rose Pink", color: "rgba(255, 182, 193, 0.6)", value: "#FFB6C1" },
  { name: "Coral", color: "rgba(255, 127, 80, 0.6)", value: "#FF7F50" },
  { name: "Nude Beige", color: "rgba(205, 133, 63, 0.5)", value: "#CD853F" },
  { name: "Berry", color: "rgba(139, 69, 19, 0.6)", value: "#8B4513" },
  { name: "Bright Orange", color: "rgba(255, 69, 0, 0.6)", value: "#FF4500" },
  { name: "Deep Brown", color: "rgba(160, 82, 45, 0.6)", value: "#A0522D" },
  { name: "Wine Red", color: "rgba(128, 0, 0, 0.7)", value: "#800000" },
];

const eyeColors = [
  { name: "Charcoal", color: "rgba(54, 54, 54, 0.4)", value: "#363636" },
  { name: "Chocolate", color: "rgba(139, 69, 19, 0.3)", value: "#8B4513" },
  { name: "Navy Blue", color: "rgba(25, 25, 112, 0.3)", value: "#191970" },
  { name: "Forest Green", color: "rgba(34, 139, 34, 0.3)", value: "#228B22" },
  { name: "Royal Purple", color: "rgba(72, 61, 139, 0.3)", value: "#483D8B" },
  { name: "Golden Bronze", color: "rgba(205, 127, 50, 0.3)", value: "#CD7F32" },
  { name: "Slate Grey", color: "rgba(112, 128, 144, 0.3)", value: "#708090" },
  { name: "Pearl White", color: "rgba(255, 255, 255, 0.2)", value: "#FFFFFF" },
];

const cheekColors = [
  { name: "Soft Pink", color: "rgba(255, 192, 203, 0.4)", value: "#FFC0CB" },
  { name: "Peach Glow", color: "rgba(255, 218, 185, 0.4)", value: "#FFDAB9" },
  { name: "Coral Blush", color: "rgba(255, 127, 80, 0.35)", value: "#FF7F50" },
  { name: "Rose Gold", color: "rgba(183, 110, 121, 0.4)", value: "#B76E79" },
  { name: "Mauve", color: "rgba(224, 176, 255, 0.35)", value: "#E0B0FF" },
  { name: "Warm Bronze", color: "rgba(205, 127, 50, 0.35)", value: "#CD7F32" },
  { name: "Dusty Rose", color: "rgba(188, 143, 143, 0.35)", value: "#BC8F8F" },
  { name: "Honey Tan", color: "rgba(210, 180, 140, 0.35)", value: "#D2B48C" },
];

// Helper function to check if point is inside a polygon
const isPointInPolygon = (point: {x: number, y: number}, polygon: {x: number, y: number}[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
        (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
};

// Status Banner Component
const StatusBanner = ({ message, progress }: { message: string; progress: number }) => {
  const progressColor = useMemo(() => {
    if (progress === 0) return "bg-red-500";
    if (progress <= 20) return "bg-gray-500";
    if (progress <= 60) return "bg-yellow-500";
    return "bg-green-500";
  }, [progress]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-3 h-20 flex items-center">
      <div className="flex items-center w-full">
        <div className="flex-1">
          <p className="text-gray-700 text-base mb-2 font-medium">{message}</p>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ease-in-out ${progressColor}`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Category Tab Component
const CategoryTab = React.memo(
  ({
    icon,
    label,
    isSelected,
    onClick,
  }: {
    icon: string;
    label: string;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    return (
      <button
        onClick={onClick}
        className={`flex items-center justify-center flex-col gap-2 p-5 rounded-xl transition-all duration-300 min-h-[80px] ${
          isSelected 
            ? "bg-gradient-to-br from-pink-100 to-purple-100 text-pink-600 shadow-lg scale-105" 
            : "bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md"
        }`}
      >
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
      </button>
    );
  }
);

// Style/Color Tab Component
const StyleColorTab = React.memo(
  ({
    icon,
    label,
    isSelected,
    onClick,
  }: {
    icon: string;
    label: string;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    return (
      <button
        onClick={onClick}
        className={`flex items-center justify-center flex-col gap-2 p-4 rounded-xl transition-all duration-300 min-h-[60px] ${
          isSelected 
            ? "bg-gradient-to-br from-pink-100 to-purple-100 text-pink-600 shadow-md scale-105" 
            : "bg-white text-gray-700 hover:bg-gray-50 hover:shadow-sm"
        }`}
      >
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
      </button>
    );
  }
);

// Enhanced Style Thumbnail Component
const StyleThumbnail = React.memo(
  ({
    label,
    gradient,
    isSelected,
    onClick,
  }: {
    label: string;
    gradient: string;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    const handleClick = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }, [onClick]);

    return (
      <button
        onClick={handleClick}
        onMouseDown={(e) => e.preventDefault()}
        className={`relative overflow-hidden rounded-xl transition-all duration-300 min-h-[100px] focus:outline-none ${
          isSelected ? "ring-3 ring-pink-500 scale-105 shadow-xl" : "hover:shadow-lg"
        }`}
        style={{ background: gradient }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/40" />
        <div className="relative h-full flex items-center justify-center p-4">
          <span className="text-white text-base font-bold text-center drop-shadow-lg">{label}</span>
        </div>
        {isSelected && (
          <div className="absolute top-2 right-2">
            <div className="bg-pink-500 rounded-full p-1">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
      </button>
    );
  }
);

// Enhanced Color Selection Button
const ColorButton = React.memo(
  ({
    colorName,
    value,
    isSelected,
    onClick,
  }: {
    colorName: string;
    value: string;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    const handleClick = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }, [onClick]);

    return (
      <button
        onClick={handleClick}
        onMouseDown={(e) => e.preventDefault()}
        className={`w-14 h-14 rounded-xl transition-all duration-300 border-2 focus:outline-none ${
          isSelected 
            ? "ring-3 ring-offset-2 ring-pink-500 scale-110 border-white shadow-lg transform" 
            : "border-gray-200 hover:border-gray-300 hover:scale-105"
        }`}
        style={{ backgroundColor: value }}
        title={colorName}
      >
        {isSelected && (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </button>
    );
  }
);

// Enhanced Slider Component
const PropertySlider = React.memo(
  ({
    property,
    value,
    onChange,
    min = 0,
    max = 1,
    step = 0.01,
  }: {
    property: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
  }) => {
    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700 text-base font-medium">{property}</span>
          <span className="text-sm bg-gray-100 rounded-lg px-3 py-1 text-gray-600 font-mono">
            {value.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600 hover:accent-pink-700"
        />
      </div>
    );
  }
);

export default function PersonalMakeup() {
  const {
    stream,
    error: webcamError,
    restartStream,
    detectionResults,
    setCurrentView,
  } = useWebcam();
  const { setIsLoading } = useLoading();
  
  // Basic state
  const [error, setError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing camera...");
  const [progress, setProgress] = useState<number>(0);
  
  // Makeup category and styles
  const [activeCategory, setActiveCategory] = useState<MakeupCategory>("looks");
  const [selectedLookStyle, setSelectedLookStyle] = useState<LookStyle>("natural");
  const [selectedLipStyle, setSelectedLipStyle] = useState<LipStyle>("nude");
  const [selectedCheekStyle, setSelectedCheekStyle] = useState<CheekStyle>("natural");
  
  // Tab cho kiểu và màu sắc
  const [activeTab, setActiveTab] = useState<StyleColorTab>("style");
  
  // Enable/disable flags for each makeup type
  const [eyeMakeupEnabled, setEyeMakeupEnabled] = useState<boolean>(true);
  const [lipMakeupEnabled, setLipMakeupEnabled] = useState<boolean>(true);
  const [cheekMakeupEnabled, setCheekMakeupEnabled] = useState<boolean>(true);
  
  // Makeup properties
  const [lookProperties, setLookProperties] = useState<MakeupProperties>({
    color: eyeColors[1].color, // Chocolate
    brightness: 0.4,
    intensity: 0.5,
    size: 0.05,
    shine: 0.3,
  });
  
  const [lipProperties, setLipProperties] = useState<MakeupProperties>({
    color: lipColors[3].color, // Nude Beige
    brightness: 0.6,
    intensity: 0.5,
    size: 0.08,
    shine: 0.25,
  });
  
  const [cheekProperties, setCheekProperties] = useState<MakeupProperties>({
    color: cheekColors[0].color, // Soft Pink
    brightness: 0.6,
    intensity: 0.5,
    size: 0.2,
    shine: 0.15,
  });
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayVideoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastRenderTime = useRef<number>(0);
  const frameCounter = useRef<number>(0);
  
  // Constants
  const RENDER_INTERVAL = 33; // ~30fps
  const SKIP_FRAMES = 1;

  // Setup and cleanup
  useEffect(() => {
    setCurrentView(VIEWS.COSMETIC_SURGERY);
    
    setIsLoading(true);
    setStatusMessage("Starting camera...");
    setProgress(10);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);
  
  // Setup video stream
  useEffect(() => {
    if (!stream || !displayVideoRef.current) return;
    
    displayVideoRef.current.srcObject = stream;
    displayVideoRef.current.onloadedmetadata = () => {
      const video = displayVideoRef.current;
      if (!video) return;
      
      video.play().catch((err: any) => {
        console.error("[PersonalMakeup] Error playing video:", err);
        setError("Cannot initialize video: " + err.message);
      });
      
      if (canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        
        if (canvasRef.current.style) {
          canvasRef.current.style.willChange = 'transform';
          canvasRef.current.style.transform = 'translateZ(0)';
        }
      }
      
      setIsVideoReady(true);
      setIsLoading(false);
      setStatusMessage("Ready to apply makeup");
      setProgress(100);
    };
  }, [stream, setIsLoading]);

  // Handle face detection status
  useEffect(() => {
    if (!detectionResults?.face?.faceLandmarks) {
      if (statusMessage !== "Face not detected. Please adjust your position.") {
        setStatusMessage("Face not detected. Please adjust your position.");
        setProgress(0);
      }
    } else if (statusMessage === "Face not detected. Please adjust your position.") {
      setStatusMessage("Face detected. Applying makeup...");
      setProgress(100);
    }
  }, [detectionResults, statusMessage]);
  
  // ULTRA REALISTIC EYELASHES - nhiều sợi hơn, tự nhiên hơn
  const drawEyelashes = useCallback((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number) => {
    if (!landmarks || landmarks.length < 468) return;
    
    const { intensity, size } = lookProperties;
    
    // Natural eyelash color
    const eyelashColor = `rgba(20, 15, 10, ${0.85 + intensity * 0.15})`;
    
    // NHIỀU LÔNG MÍ HỚN - realistic counts
    const baseLength = Math.max(5, size * 30);
    const upperLashCount = Math.floor(40 + intensity * 30); // 40-70 lashes per eye
    const lowerLashCount = Math.floor(upperLashCount * 0.6); // 60% of upper lashes
    const eyelashWidth = 0.08 + size * 0.12; // Ultra thin
    
    ctx.save();
    ctx.strokeStyle = eyelashColor;
    ctx.lineWidth = eyelashWidth;
    ctx.lineCap = "round";
    
    // EXTENSIVE upper eyelid points for ultra-even distribution
    const leftUpperEyelid = [
      33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
      // Additional micro-points for smoother distribution
      246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33
    ];
    const rightUpperEyelid = [
      362, 382, 381, 380, 374, 373, 390, 249, 263, 398, 384, 385, 386, 387, 388, 466,
      // Additional micro-points for smoother distribution
      466, 388, 387, 386, 385, 384, 398, 263, 249, 390, 373, 374, 380, 381, 382, 362
    ];
    
    // Lower eyelid points - MÍ DƯỚI chỉ ở phần giữa mắt
    const leftLowerEyelid = [
      157, 158, 159, 160, 161 // CHỈ phần giữa mắt dưới
    ];
    const rightLowerEyelid = [
      384, 385, 386, 387, 388 // CHỈ phần giữa mắt dưới
    ];
    
    // Draw PERFECT upper eyelashes
    const drawUpperLashes = (eyelidPoints: number[], isLeftEye: boolean) => {
      for (let i = 0; i < upperLashCount; i++) {
        const t = i / Math.max(1, upperLashCount - 1);
        const segmentLength = (eyelidPoints.length - 1);
        const exactPosition = t * segmentLength;
        const pointIndex = Math.floor(exactPosition);
        const nextPointIndex = Math.min(pointIndex + 1, eyelidPoints.length - 1);
        
        const pt1 = landmarks[eyelidPoints[pointIndex]];
        const pt2 = landmarks[eyelidPoints[nextPointIndex]];
        const localT = exactPosition - pointIndex;
        
        // Perfect interpolation
        const interpolatedX = pt1.x + (pt2.x - pt1.x) * localT;
        const interpolatedY = pt1.y + (pt2.y - pt1.y) * localT;
        
        // Natural upward direction with position-based curve
        let baseAngle = -Math.PI/2; // Straight up
        const positionFactor = (t - 0.5) * 2; // -1 to 1
        baseAngle += positionFactor * 0.7; // More natural curve
        
        // Minimal randomness for consistency
        const angle = baseAngle + (Math.random() - 0.5) * 0.08;
        
        const startX = interpolatedX * width;
        const startY = interpolatedY * height;
        
        // Consistent length with subtle variation
        const lengthVariation = 0.9 + Math.random() * 0.2;
        const eyelashLength = baseLength * lengthVariation;
        
        const endX = startX + Math.cos(angle) * eyelashLength;
        const endY = startY + Math.sin(angle) * eyelashLength;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    };
    
    // Draw REALISTIC lower eyelashes - CHỈ Ở GIỮA, HƯỚNG XUỐNG DƯỚI CHÉO
    const drawLowerLashes = (eyelidPoints: number[], isLeftEye: boolean) => {
      for (let i = 0; i < lowerLashCount; i++) {
        const t = i / Math.max(1, lowerLashCount - 1);
        const segmentLength = (eyelidPoints.length - 1);
        const exactPosition = t * segmentLength;
        const pointIndex = Math.floor(exactPosition);
        const nextPointIndex = Math.min(pointIndex + 1, eyelidPoints.length - 1);
        
        const pt1 = landmarks[eyelidPoints[pointIndex]];
        const pt2 = landmarks[eyelidPoints[nextPointIndex]];
        const localT = exactPosition - pointIndex;
        
        const interpolatedX = pt1.x + (pt2.x - pt1.x) * localT;
        const interpolatedY = pt1.y + (pt2.y - pt1.y) * localT;
        
        // REALISTIC lower lash direction - HƯỚNG XUỐNG DƯỚI VÀ CHÉO RA NGOÀI
        let angle = Math.PI/2 + 0.2; // Xuống dưới + chéo ra ngoài
        const positionFactor = (t - 0.5) * 2;
        
        // Lông mí ngoài chéo ra nhiều hơn, lông mí trong ít hơn
        if (isLeftEye) {
          angle += positionFactor * 0.3; // Trái: từ trong ra ngoài
        } else {
          angle -= positionFactor * 0.3; // Phải: từ ngoài vào trong
        }
        
        // Minimal randomness
        angle += (Math.random() - 0.5) * 0.05;
        
        const startX = interpolatedX * width;
        const startY = interpolatedY * height;
        
        // Shorter and more consistent lower lashes
        const lengthVariation = 0.8 + Math.random() * 0.15;
        const lowerLashLength = baseLength * 0.25 * lengthVariation; // Ngắn hơn nhiều
        
        const endX = startX + Math.cos(angle) * lowerLashLength;
        const endY = startY + Math.sin(angle) * lowerLashLength;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    };
    
    // Draw lashes for both eyes
    drawUpperLashes(leftUpperEyelid, true);
    drawUpperLashes(rightUpperEyelid, false);
    
    if (intensity > 0.2) {
      drawLowerLashes(leftLowerEyelid, true);
      drawLowerLashes(rightLowerEyelid, false);
    }
    
    ctx.restore();
  }, [lookProperties]);

  const drawEyes = useCallback((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number) => {
    if (!landmarks || landmarks.length < 468 || !eyeMakeupEnabled) return;
    
    const { color, brightness, intensity, size, shine } = lookProperties;
    
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (!rgbaMatch) return;
    
    const [_, r, g, b, a] = rgbaMatch.map(Number);
    
    const brightnessFactor = 0.6 + brightness * 0.4;
    const finalR = Math.min(255, r * brightnessFactor);
    const finalG = Math.min(255, g * brightnessFactor);
    const finalB = Math.min(255, b * brightnessFactor);
    
    // Giảm độ dày của đường viền và điều chỉnh các giá trị
    let eyelinerWidth = 0.4 + size * 0.8; // Giảm từ 0.7 xuống 0.4
    let eyeshadowBlur = 3 + size * 4;
    let eyelinerOpacity = a * (0.4 + intensity * 0.3); // Giảm độ đậm
    
    // Điều chỉnh style
    if (selectedLookStyle === "cat") {
      eyelinerWidth += 0.3; // Giảm từ 0.4 xuống 0.3
      eyelinerOpacity *= 1.2;
    } else if (selectedLookStyle === "smokey") {
      eyeshadowBlur += 3;
      eyelinerOpacity *= 1.1;
      eyelinerWidth += 0.2; // Giảm từ 0.3 xuống 0.2
    } else if (selectedLookStyle === "nude") {
      eyelinerWidth *= 0.6;
      eyelinerOpacity *= 0.8;
    }
    
    const eyelinerColor = `rgba(${finalR * 0.5}, ${finalG * 0.5}, ${finalB * 0.5}, ${eyelinerOpacity})`;
    const eyeshadowColor = `rgba(${finalR}, ${finalG}, ${finalB}, ${eyelinerOpacity * 0.3})`;
    
    // Điểm kẻ viền mắt - giữ nguyên
    const leftEyeliner = [33, 7, 163, 144, 145, 153, 154, 155, 133];
    const rightEyeliner = [362, 382, 381, 380, 374, 373, 390, 249, 263];
    
    // Điểm cho viền mí dưới
    const leftLowerEyelid = [33, 246, 161, 160, 159, 158, 157, 173, 133];
    const rightLowerEyelid = [362, 466, 388, 387, 386, 385, 384, 398, 263];
    
    ctx.save();
    
    // Vẽ phần bóng mắt - nếu cần
    if (selectedLookStyle !== "nude" && intensity > 0.3) {
      ctx.filter = `blur(${eyeshadowBlur}px)`;
      
      const drawElongatedEyeshadow = (eyelinerPoints: number[], isLeftEye: boolean) => {
        ctx.fillStyle = eyeshadowColor;
        ctx.beginPath();
        
        // Giảm độ mở rộng ở góc mắt
        const outerExtension = width * 0.005; // Giảm từ 0.008 xuống 0.005
        const innerExtension = width * 0.003; // Giảm từ 0.006 xuống 0.003
        
        // Bắt đầu từ góc ngoài đã MỞ RỘNG
        const startPoint = landmarks[eyelinerPoints[0]];
        const extendedStartX = isLeftEye ? 
          startPoint.x * width - outerExtension : // Mắt trái: mở rộng bên trái
          startPoint.x * width + outerExtension;   // Mắt phải: mở rộng bên phải
        
        ctx.moveTo(extendedStartX, startPoint.y * height);
        
        // Vẽ theo đường viền mí mắt một cách tự nhiên
        for (let i = 1; i < eyelinerPoints.length; i++) {
          const current = landmarks[eyelinerPoints[i]];
          if (i < eyelinerPoints.length - 1) {
            const next = landmarks[eyelinerPoints[i + 1]];
            const cpX = current.x * width;
            const cpY = current.y * height - height * 0.003;
            const endX = (current.x + next.x) / 2 * width;
            const endY = (current.y + next.y) / 2 * height - height * 0.003;
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
          } else {
            // Kết thúc ở góc trong đã MỞ RỘNG
            const extendedEndX = isLeftEye ?
              current.x * width + innerExtension : // Mắt trái: mở rộng bên phải
              current.x * width - innerExtension;   // Mắt phải: mở rộng bên trái
            ctx.lineTo(extendedEndX, current.y * height);
          }
        }
        
        // Tạo vùng bóng mắt phía trên mí mắt
        for (let i = eyelinerPoints.length - 1; i >= 0; i--) {
          const current = landmarks[eyelinerPoints[i]];
          const shadowY = current.y * height - height * (0.010 + intensity * 0.008);
          
          let shadowX = current.x * width;
          if (i === eyelinerPoints.length - 1) {
            // Mở rộng góc trong
            shadowX = isLeftEye ?
              shadowX + innerExtension :
              shadowX - innerExtension;
          } else if (i === 0) {
            // Mở rộng góc ngoài
            shadowX = isLeftEye ?
              shadowX - outerExtension :
              shadowX + outerExtension;
          }
          
          ctx.lineTo(shadowX, shadowY);
        }
        
        ctx.closePath();
        ctx.fill();
      };
      
      drawElongatedEyeshadow(leftEyeliner, true);
      drawElongatedEyeshadow(rightEyeliner, false);
    }
    
    // ĐƯỜNG VIỀN MẮT MỎng hơn và KHÓE MẮT NGẮN HƠN
    ctx.filter = `blur(${0.1 + size * 0.15}px)`; // Giảm độ mờ
    ctx.strokeStyle = eyelinerColor;
    ctx.lineWidth = eyelinerWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  
    const drawRefinedEyeliner = (eyelinerPoints: number[], isLeftEye: boolean) => {
      // Giảm độ mở rộng ở khóe mắt
      const outerExtension = width * 0.004; // Giảm từ 0.012 xuống 0.004
      const innerExtension = width * 0.002; // Giảm từ 0.007 xuống 0.002
      
      ctx.beginPath();
      
      // Bắt đầu từ góc ngoài nhưng MỞ RỘNG ÍT HƠN
      const startPoint = landmarks[eyelinerPoints[0]];
      const extendedStartX = isLeftEye ? 
        startPoint.x * width - outerExtension : // Mắt trái: mở rộng bên trái
        startPoint.x * width + outerExtension;   // Mắt phải: mở rộng bên phải
      
      // Bắt đầu với đường cong nhẹ nhàng hơn
      ctx.moveTo(extendedStartX, startPoint.y * height);
      
      // Kết nối mượt mà đến điểm thực tế của góc ngoài
      if (isLeftEye) {
        // Điểm kiểm soát gần góc ngoài hơn để tạo đường cong tự nhiên
        const ctrlX = startPoint.x * width - outerExtension * 0.5;
        ctx.quadraticCurveTo(
          ctrlX, 
          startPoint.y * height,
          startPoint.x * width, 
          startPoint.y * height
        );
      } else {
        // Điểm kiểm soát gần góc ngoài hơn để tạo đường cong tự nhiên
        const ctrlX = startPoint.x * width + outerExtension * 0.5;
        ctx.quadraticCurveTo(
          ctrlX, 
          startPoint.y * height,
          startPoint.x * width, 
          startPoint.y * height
        );
      }
      
      // Vẽ đường cong mượt mà theo hình dạng mí mắt tự nhiên
      for (let i = 1; i < eyelinerPoints.length - 1; i++) {
        const current = landmarks[eyelinerPoints[i]];
        const next = landmarks[eyelinerPoints[i + 1]];
        
        const cpX = current.x * width;
        const cpY = current.y * height;
        const endX = (current.x + next.x) / 2 * width;
        const endY = (current.y + next.y) / 2 * height;
        
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      }
      
      // Tiếp tục đến góc trong thực tế
      const lastPoint = landmarks[eyelinerPoints[eyelinerPoints.length - 1]];
      ctx.lineTo(lastPoint.x * width, lastPoint.y * height);
      
      // Mở rộng ở góc trong NHƯNG NGẮN HƠN
      const extendedEndX = isLeftEye ?
        lastPoint.x * width + innerExtension : // Mắt trái: mở rộng bên phải
        lastPoint.x * width - innerExtension;   // Mắt phải: mở rộng bên trái
      
      // Áp dụng đường cong nhẹ nhàng hơn cho phần mở rộng ở góc trong
      if (isLeftEye) {
        // Điểm kiểm soát gần góc trong hơn để tạo đường cong tự nhiên
        const ctrlX = lastPoint.x * width + innerExtension * 0.5;
        ctx.quadraticCurveTo(
          ctrlX,
          lastPoint.y * height,
          extendedEndX,
          lastPoint.y * height
        );
      } else {
        // Điểm kiểm soát gần góc trong hơn để tạo đường cong tự nhiên
        const ctrlX = lastPoint.x * width - innerExtension * 0.5;
        ctx.quadraticCurveTo(
          ctrlX,
          lastPoint.y * height,
          extendedEndX,
          lastPoint.y * height
        );
      }
      
      ctx.stroke();
    };
  
    // Vẽ đường viền mắt mỏng hơn cho cả hai mắt
    drawRefinedEyeliner(leftEyeliner, true);
    drawRefinedEyeliner(rightEyeliner, false);
    
    // Viền mí dưới tinh tế hơn - chỉ khi intensity cao
    if (intensity > 0.6) {
      const lowerOpacity = eyelinerOpacity * 0.2; // Giảm từ 0.3 xuống 0.2
      const lowerColor = `rgba(${finalR * 0.7}, ${finalG * 0.7}, ${finalB * 0.7}, ${lowerOpacity})`;
      ctx.strokeStyle = lowerColor;
      ctx.lineWidth = eyelinerWidth * 0.4; // Giữ nguyên nhưng đường viền chính đã mỏng hơn
      
      // Chỉ vẽ góc ngoài - tránh đường kẻ ở giữa
      const drawOuterLowerLiner = (isLeft: boolean) => {
        const outerCorner = isLeft ? landmarks[33] : landmarks[362];
        const midPoint = isLeft ? landmarks[160] : landmarks[387];
        
        if (!outerCorner || !midPoint) return;
        
        ctx.beginPath();
        ctx.moveTo(outerCorner.x * width, outerCorner.y * height);
        
        // Chỉ vẽ từ góc ngoài về phía giữa, dừng lại ở 50% (ngắn hơn trước đây)
        const stopX = outerCorner.x + (midPoint.x - outerCorner.x) * 0.5; // Giảm từ 0.6 xuống 0.5
        const stopY = outerCorner.y + (midPoint.y - outerCorner.y) * 0.5;
        
        // Sử dụng đường cong để tạo đường mượt mà hơn
        const ctrlX = outerCorner.x + (stopX - outerCorner.x) * 0.5;
        const ctrlY = outerCorner.y + (stopY - outerCorner.y) * 0.5 + 0.001; // Điều chỉnh độ cong nhẹ
        
        ctx.quadraticCurveTo(ctrlX * width, ctrlY * height, stopX * width, stopY * height);
        ctx.stroke();
      };
      
      drawOuterLowerLiner(true);  // Mắt trái
      drawOuterLowerLiner(false); // Mắt phải
    }
    
    // Phong cách "cat" - đường cat eye cũng mỏng hơn và ngắn hơn
    if (selectedLookStyle === "cat" && intensity > 0.7) {
      ctx.filter = `blur(${0.1}px)`;
      const catLinerColor = `rgba(${finalR * 0.4}, ${finalG * 0.4}, ${finalB * 0.4}, ${eyelinerOpacity * 1.2})`;
      ctx.fillStyle = catLinerColor;
      
      // Đường cat eye cân đối hơn
      const drawProportionateCatWing = (isLeftEye: boolean) => {
        const outerCorner = isLeftEye ? landmarks[33] : landmarks[362];
        if (!outerCorner) return;
        
        // Giảm kích thước đường cat eye
        const wingLength = width * (0.006 + size * 0.004); // Giảm từ 0.008 xuống 0.006
        const wingHeight = height * (0.004 + size * 0.003); // Giảm từ 0.005 xuống 0.004
        const wingThickness = height * 0.002; // Giữ nguyên độ mỏng
        
        const startX = outerCorner.x * width;
        const startY = outerCorner.y * height;
        
        if (isLeftEye) {
          // Mắt trái - đường cat eye sang trái và lên
          ctx.beginPath();
          
          // Đầu cánh - gần và thấp hơn
          const tipX = startX - wingLength;
          const tipY = startY - wingHeight;
          
          // Đường cánh trên
          ctx.moveTo(startX, startY);
          // Thêm đường cong cho cánh trên để trông tự nhiên hơn
          ctx.quadraticCurveTo(
            startX - wingLength * 0.5, 
            startY - wingHeight * 0.3, 
            tipX, 
            tipY
          );
          
          // Đường cánh dưới - tạo tam giác tinh tế
          ctx.lineTo(startX - wingLength * 0.6, startY - wingThickness);
          
          // Trở lại điểm bắt đầu
          ctx.lineTo(startX, startY);
          ctx.closePath();
          ctx.fill();
          
        } else {
          // Mắt phải - đường cat eye sang phải và lên
          ctx.beginPath();
          
          // Đầu cánh - gần và thấp hơn
          const tipX = startX + wingLength;
          const tipY = startY - wingHeight;
          
          // Đường cánh trên
          ctx.moveTo(startX, startY);
          // Thêm đường cong cho cánh trên để trông tự nhiên hơn
          ctx.quadraticCurveTo(
            startX + wingLength * 0.5, 
            startY - wingHeight * 0.3, 
            tipX, 
            tipY
          );
          
          // Đường cánh dưới - tạo tam giác tinh tế
          ctx.lineTo(startX + wingLength * 0.6, startY - wingThickness);
          
          // Trở lại điểm bắt đầu
          ctx.lineTo(startX, startY);
          ctx.closePath();
          ctx.fill();
        }
      };
      
      // Vẽ đường cat eye cho cả hai mắt
      drawProportionateCatWing(true);  // Mắt trái
      drawProportionateCatWing(false); // Mắt phải
    }
    
    ctx.restore();
    
    // Vẽ lông mi thực tế ở cuối
    drawEyelashes(ctx, landmarks, width, height);
  }, [lookProperties, selectedLookStyle, drawEyelashes, eyeMakeupEnabled]);
  
    // NATURAL LIP MAKEUP - Follow exact lip contours, extended edges
  const drawLips = useCallback((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number) => {
    if (!landmarks || landmarks.length < 468 || !lipMakeupEnabled) return;
    
    const { color, brightness, intensity, size, shine } = lipProperties;
    
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (!rgbaMatch) return;
    
    const [_, r, g, b, a] = rgbaMatch.map(Number);
    
    const brightnessFactor = 0.7 + brightness * 0.3;
    const finalR = Math.min(255, r * brightnessFactor);
    const finalG = Math.min(255, g * brightnessFactor);
    const finalB = Math.min(255, b * brightnessFactor);
    const opacity = a * (0.4 + intensity * 0.6);
    
    let lipColor = `rgba(${finalR}, ${finalG}, ${finalB}, ${opacity})`;
    let blurRadius = 0.2 + size * 0.3;
    
    if (selectedLipStyle === "matte") {
      blurRadius = 0.05; // Sharper for matte
    } else if (selectedLipStyle === "glossy") {
      blurRadius = 0.1; // Sharper for glossy too
      lipColor = `rgba(${Math.min(255, finalR * 1.05)}, ${Math.min(255, finalG * 1.05)}, ${Math.min(255, finalB * 1.05)}, ${opacity * 1.1})`;
    } else if (selectedLipStyle === "tint") {
      blurRadius = 0.2; // Only tint gets more blur
      lipColor = `rgba(${finalR}, ${finalG}, ${finalB}, ${opacity * 0.75})`;
    }
    
    // EXTENDED LIP CONTOURS - Natural shape with extended corners
    const extendFactor = 0.003; // Extend slightly beyond natural lip corners
    
    // Upper lip - smooth natural contour
    const upperLipContour = [
      61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291
    ];
    
    // Lower lip - smooth natural contour  
    const lowerLipContour = [
      146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308
    ];
    
    // Mouth opening line (inner boundary)
    const mouthLine = [
      78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78
    ];

    ctx.save();
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.fillStyle = lipColor;
    
    // Helper function to create smooth path through points
    const createSmoothPath = (points: number[], extend: boolean = false) => {
      const validPoints = points.filter(idx => landmarks[idx]);
      if (validPoints.length < 3) return [];
      
      const pathPoints: Array<{x: number, y: number}> = [];
      
      validPoints.forEach((idx, i) => {
        const point = landmarks[idx];
        let x = point.x * width;
        let y = point.y * height;
        
        // Extend corners for natural makeup look
        if (extend) {
          if (i === 0) { // Left corner
            x -= width * extendFactor;
          } else if (i === validPoints.length - 1) { // Right corner
            x += width * extendFactor;
          }
        }
        
        pathPoints.push({x, y});
      });
      
      return pathPoints;
    };
    
    // DRAW UPPER LIP - Extended and smooth
    const upperPoints = createSmoothPath(upperLipContour, true);
    const upperMouthPoints = createSmoothPath([78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]);
    
    if (upperPoints.length >= 3 && upperMouthPoints.length >= 3) {
      ctx.beginPath();
      
      // Start from extended left corner
      ctx.moveTo(upperPoints[0].x, upperPoints[0].y);
      
      // Draw smooth upper lip contour
      for (let i = 1; i < upperPoints.length - 1; i++) {
        const current = upperPoints[i];
        const next = upperPoints[i + 1];
        const cpX = current.x;
        const cpY = current.y;
        const endX = (current.x + next.x) / 2;
        const endY = (current.y + next.y) / 2;
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      }
      
      // End at extended right corner
      ctx.lineTo(upperPoints[upperPoints.length - 1].x, upperPoints[upperPoints.length - 1].y);
      
      // Connect to mouth line (right to left)
      ctx.lineTo(upperMouthPoints[upperMouthPoints.length - 1].x, upperMouthPoints[upperMouthPoints.length - 1].y);
      
      // Draw mouth line back (smooth)
      for (let i = upperMouthPoints.length - 2; i >= 1; i--) {
        const current = upperMouthPoints[i];
        const prev = upperMouthPoints[i - 1];
        const cpX = current.x;
        const cpY = current.y;
        const endX = (current.x + prev.x) / 2;
        const endY = (current.y + prev.y) / 2;
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      }
      
      // Close to start
      ctx.lineTo(upperMouthPoints[0].x, upperMouthPoints[0].y);
      ctx.closePath();
      ctx.fill();
    }
    
    // DRAW LOWER LIP - CLEAN RIGHT CORNER, NO EXCESS COLOR
    // REFINED: Remove landmarks causing excess color on right side
    const lowerLipOuter = [61, 146, 91, 181, 84, 17, 314, 405, 320, 291]; // Removed 307, 375, 321 - these cause excess
    const lowerLipInner = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]; // Clean inner line
    
    const lowerOuterPoints = createSmoothPath(lowerLipOuter, true);
    const lowerInnerPoints = createSmoothPath(lowerLipInner, false);
    
    if (lowerOuterPoints.length >= 3 && lowerInnerPoints.length >= 3) {
      ctx.beginPath();
      
      // Start from LEFT CORNER
      ctx.moveTo(lowerOuterPoints[0].x, lowerOuterPoints[0].y);
      
      // Draw clean outer contour - no excess landmarks
      for (let i = 1; i < lowerOuterPoints.length - 1; i++) {
        const current = lowerOuterPoints[i];
        const next = lowerOuterPoints[i + 1];
        const cpX = current.x;
        const cpY = current.y;
        const endX = (current.x + next.x) / 2;
        const endY = (current.y + next.y) / 2;
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      }
      
      // End cleanly at RIGHT CORNER (291) - no excess
      ctx.lineTo(lowerOuterPoints[lowerOuterPoints.length - 1].x, lowerOuterPoints[lowerOuterPoints.length - 1].y);
      
      // Connect to inner line cleanly
      ctx.lineTo(lowerInnerPoints[lowerInnerPoints.length - 1].x, lowerInnerPoints[lowerInnerPoints.length - 1].y);
      
      // Draw inner line back - precise path
      for (let i = lowerInnerPoints.length - 2; i >= 1; i--) {
        const current = lowerInnerPoints[i];
        const prev = lowerInnerPoints[i - 1];
        const cpX = current.x;
        const cpY = current.y;
        const endX = (current.x + prev.x) / 2;
        const endY = (current.y + prev.y) / 2;
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      }
      
      // Close cleanly at LEFT CORNER
      ctx.lineTo(lowerInnerPoints[0].x, lowerInnerPoints[0].y);
      ctx.closePath();
      ctx.fill();
    }
    // OMBRE EFFECT - Natural gradient
  if (selectedLipStyle === "ombre") {
    const topPoint = landmarks[13];
    const bottomPoint = landmarks[14];
    
    if (topPoint && bottomPoint) {
      const gradient = ctx.createLinearGradient(
        topPoint.x * width, topPoint.y * height,
        bottomPoint.x * width, bottomPoint.y * height
      );
      gradient.addColorStop(0, `rgba(${finalR * 0.8}, ${finalG * 0.8}, ${finalB * 0.8}, ${opacity * 0.85})`);
      gradient.addColorStop(0.5, lipColor);
      gradient.addColorStop(1, `rgba(${Math.min(255, finalR * 1.12)}, ${Math.min(255, finalG * 1.12)}, ${Math.min(255, finalB * 1.12)}, ${opacity})`);
      
      ctx.fillStyle = gradient;
      
      // Re-apply gradient to both lips
      // Upper lip with gradient
      if (upperPoints.length >= 3 && upperMouthPoints.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(upperPoints[0].x, upperPoints[0].y);
        
        for (let i = 1; i < upperPoints.length - 1; i++) {
          const current = upperPoints[i];
          const next = upperPoints[i + 1];
          const cpX = current.x;
          const cpY = current.y;
          const endX = (current.x + next.x) / 2;
          const endY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        
        ctx.lineTo(upperPoints[upperPoints.length - 1].x, upperPoints[upperPoints.length - 1].y);
        ctx.lineTo(upperMouthPoints[upperMouthPoints.length - 1].x, upperMouthPoints[upperMouthPoints.length - 1].y);
        
        for (let i = upperMouthPoints.length - 2; i >= 1; i--) {
          const current = upperMouthPoints[i];
          const prev = upperMouthPoints[i - 1];
          const cpX = current.x;
          const cpY = current.y;
          const endX = (current.x + prev.x) / 2;
          const endY = (current.y + prev.y) / 2;
          ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        
        ctx.lineTo(upperMouthPoints[0].x, upperMouthPoints[0].y);
        ctx.closePath();
        ctx.fill();
      }
      
      // Lower lip with gradient - CLEAN RIGHT CORNER
      const gradLowerOuter = createSmoothPath([61, 146, 91, 181, 84, 17, 314, 405, 320, 291], true);
      const gradLowerInner = createSmoothPath([78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308], false);
      
      if (gradLowerOuter.length >= 3 && gradLowerInner.length >= 3) {
        ctx.beginPath();
        
        ctx.moveTo(gradLowerOuter[0].x, gradLowerOuter[0].y);
        
        for (let i = 1; i < gradLowerOuter.length - 1; i++) {
          const current = gradLowerOuter[i];
          const next = gradLowerOuter[i + 1];
          const cpX = current.x;
          const cpY = current.y;
          const endX = (current.x + next.x) / 2;
          const endY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        
        ctx.lineTo(gradLowerOuter[gradLowerOuter.length - 1].x, gradLowerOuter[gradLowerOuter.length - 1].y);
        ctx.lineTo(gradLowerInner[gradLowerInner.length - 1].x, gradLowerInner[gradLowerInner.length - 1].y);
        
        for (let i = gradLowerInner.length - 2; i >= 1; i--) {
          const current = gradLowerInner[i];
          const prev = gradLowerInner[i - 1];
          const cpX = current.x;
          const cpY = current.y;
          const endX = (current.x + prev.x) / 2;
          const endY = (current.y + prev.y) / 2;
          ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        
        ctx.lineTo(gradLowerInner[0].x, gradLowerInner[0].y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  
  // GLOSSY SHINE - Subtle and natural
  if (selectedLipStyle === "glossy" && shine > 0.3) {
    ctx.filter = `blur(${blurRadius * 0.5}px)`;
    
    const shineOpacity = shine * 0.25;
    const shineColor = `rgba(${Math.min(255, finalR * 1.2)}, ${Math.min(255, finalG * 1.2)}, ${Math.min(255, finalB * 1.2)}, ${shineOpacity})`;
    
    ctx.fillStyle = shineColor;
    
    // Natural shine area on cupid's bow
    const shinePoints = [39, 37, 0, 267, 269];
    const shineInner = [81, 82, 13, 312, 311];
    
    if (shinePoints.every(idx => landmarks[idx]) && shineInner.every(idx => landmarks[idx])) {
      ctx.beginPath();
      
      // Shine area outer edge
      ctx.moveTo(landmarks[39].x * width, landmarks[39].y * height);
      for (let i = 1; i < shinePoints.length; i++) {
        const point = landmarks[shinePoints[i]];
        ctx.lineTo(point.x * width, point.y * height);
      }
      
      // Connect to inner edge
      ctx.lineTo(landmarks[311].x * width, landmarks[311].y * height);
      
      // Inner edge back
      for (let i = shineInner.length - 2; i >= 0; i--) {
        const point = landmarks[shineInner[i]];
        ctx.lineTo(point.x * width, point.y * height);
      }
      
      ctx.closePath();
      ctx.fill();
    }
  }
  
  ctx.restore();
  }, [lipProperties, selectedLipStyle, lipMakeupEnabled]);

  // ENHANCED CHEEKS
  const drawCheeks = useCallback((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number) => {
    if (!landmarks || landmarks.length < 468 || !cheekMakeupEnabled) return;
    
    const { color, brightness, intensity, size, shine } = cheekProperties;
    
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (!rgbaMatch) return;
    
    const [_, r, g, b, a] = rgbaMatch.map(Number);
    
    const brightnessFactor = 0.8 + brightness * 0.2;
    const blushRadius = Math.min(width, height) * (0.040 + size * 0.035);
    const blushOpacity = a * (0.7 + intensity * 0.4); // More visible
    
    const blushColor = `rgba(${r * brightnessFactor}, ${g * brightnessFactor}, ${b * brightnessFactor}, ${blushOpacity})`;
    
    // Precise cheek positions
    let leftCheekPoints: any[] = [];
    let rightCheekPoints: any[] = [];
    
    if (selectedCheekStyle === "natural" || selectedCheekStyle === "blush") {
      leftCheekPoints = [
        { point: landmarks[116], weight: 1.0 }, // Main apple
        { point: landmarks[117], weight: 0.8 }, // Upper apple
        { point: landmarks[118], weight: 0.6 }, // Side apple
      ];
      rightCheekPoints = [
        { point: landmarks[345], weight: 1.0 }, // Main apple
        { point: landmarks[346], weight: 0.8 }, // Upper apple  
        { point: landmarks[347], weight: 0.6 }, // Side apple
      ];
    } else if (selectedCheekStyle === "contour") {
      leftCheekPoints = [
        { point: landmarks[50], weight: 1.0 },   // Main contour
        { point: landmarks[36], weight: 0.9 },   // Upper contour
        { point: landmarks[206], weight: 0.7 },  // Lower contour
      ];
      rightCheekPoints = [
        { point: landmarks[280], weight: 1.0 },  // Main contour
        { point: landmarks[266], weight: 0.9 },  // Upper contour
        { point: landmarks[426], weight: 0.7 },  // Lower contour
      ];
    } else if (selectedCheekStyle === "highlight") {
      leftCheekPoints = [
        { point: landmarks[35], weight: 1.0 },   // Top cheekbone
        { point: landmarks[31], weight: 0.9 },   // Upper cheekbone
        { point: landmarks[228], weight: 0.7 },  // Mid cheekbone
      ];
      rightCheekPoints = [
        { point: landmarks[265], weight: 1.0 },  // Top cheekbone
        { point: landmarks[261], weight: 0.9 },  // Upper cheekbone
        { point: landmarks[448], weight: 0.7 },  // Mid cheekbone
      ];
    } else if (selectedCheekStyle === "bronzer") {
      leftCheekPoints = [
        { point: { x: (landmarks[116].x + landmarks[50].x) / 2, y: (landmarks[116].y + landmarks[50].y) / 2 }, weight: 1.0 },
        { point: landmarks[116], weight: 0.9 },
        { point: landmarks[50], weight: 0.9 },
      ];
      rightCheekPoints = [
        { point: { x: (landmarks[345].x + landmarks[280].x) / 2, y: (landmarks[345].y + landmarks[280].y) / 2 }, weight: 1.0 },
        { point: landmarks[345], weight: 0.9 },
        { point: landmarks[280], weight: 0.9 },
      ];
    }
    
    ctx.save();
    ctx.filter = `blur(${blushRadius * 0.7}px)`;
    
    if (selectedCheekStyle === "highlight") {
      const drawHighlight = (cheekPoints: any[]) => {
        cheekPoints.forEach(({ point, weight }) => {
          if (!point) return;
          
          const adjustedRadius = blushRadius * weight * 1.3;
          const gradient = ctx.createRadialGradient(
            point.x * width, point.y * height, 0,
            point.x * width, point.y * height, adjustedRadius
          );
          gradient.addColorStop(0, `rgba(255, 255, 255, ${shine * 0.95 * weight})`);
          gradient.addColorStop(0.2, `rgba(255, 255, 255, ${shine * 0.7 * weight})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${shine * 0.4 * weight})`);
          gradient.addColorStop(0.8, `rgba(255, 255, 255, ${shine * 0.2 * weight})`);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x * width, point.y * height, adjustedRadius, 0, Math.PI * 2);
          ctx.fill();
        });
      };
      
      drawHighlight(leftCheekPoints);
      drawHighlight(rightCheekPoints);
      
    } else if (selectedCheekStyle === "contour") {
      const drawContour = (cheekPoints: any[], isLeft: boolean) => {
        cheekPoints.forEach(({ point, weight }) => {
          if (!point) return;
          
          const adjustedRadius = blushRadius * weight * 2.0;
          const gradient = ctx.createRadialGradient(
            point.x * width, point.y * height, 0,
            point.x * width, point.y * height, adjustedRadius
          );
          gradient.addColorStop(0, `rgba(${r * 0.5}, ${g * 0.5}, ${b * 0.5}, ${blushOpacity * weight})`);
          gradient.addColorStop(0.3, `rgba(${r * 0.7}, ${g * 0.7}, ${b * 0.7}, ${blushOpacity * 0.8 * weight})`);
          gradient.addColorStop(0.6, `rgba(${r * 0.85}, ${g * 0.85}, ${b * 0.85}, ${blushOpacity * 0.5 * weight})`);
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.ellipse(
            point.x * width, 
            point.y * height, 
            adjustedRadius * 1.8, 
            adjustedRadius * 1.2, 
            isLeft ? -0.4 : 0.4, 
            0, 
            Math.PI * 2
          );
          ctx.fill();
        });
      };
      
      drawContour(leftCheekPoints, true);
      drawContour(rightCheekPoints, false);
      
    } else {
      // Natural blush/bronzer
      const drawBlush = (cheekPoints: any[]) => {
        cheekPoints.forEach(({ point, weight }) => {
          if (!point) return;
          
          const adjustedRadius = blushRadius * weight;
          const gradient = ctx.createRadialGradient(
            point.x * width, point.y * height, 0,
            point.x * width, point.y * height, adjustedRadius
          );
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${blushOpacity * weight})`);
          gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, ${blushOpacity * 0.9 * weight})`);
          gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${blushOpacity * 0.7 * weight})`);
          gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${blushOpacity * 0.4 * weight})`);
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x * width, point.y * height, adjustedRadius, 0, Math.PI * 2);
          ctx.fill();
        });
      };
      
      drawBlush(leftCheekPoints);
      drawBlush(rightCheekPoints);
      
      // Enhanced bronzer
      if (selectedCheekStyle === "bronzer") {
        const bronzerColor = `rgba(${r * 0.75}, ${g * 0.75}, ${b * 0.75}, ${blushOpacity * 0.6})`;
        
        // Forehead bronzing
        const foreheadPoints = [
          { x: landmarks[9].x, y: landmarks[9].y - 0.030 },
          { x: landmarks[10].x, y: landmarks[10].y - 0.025 },
        ];
        
        foreheadPoints.forEach((point) => {
          const foreheadGradient = ctx.createRadialGradient(
            point.x * width, point.y * height, 0,
            point.x * width, point.y * height, blushRadius * 1.0
          );
          foreheadGradient.addColorStop(0, bronzerColor);
          foreheadGradient.addColorStop(0.5, `rgba(${r * 0.85}, ${g * 0.85}, ${b * 0.85}, ${blushOpacity * 0.4})`);
          foreheadGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          
          ctx.fillStyle = foreheadGradient;
          ctx.beginPath();
          ctx.arc(point.x * width, point.y * height, blushRadius * 1.0, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Nose bridge bronzing
        const nosePoint = landmarks[6];
        if (nosePoint) {
          ctx.fillStyle = `rgba(${r * 0.8}, ${g * 0.8}, ${b * 0.8}, ${blushOpacity * 0.4})`;
          ctx.beginPath();
          ctx.arc(nosePoint.x * width, nosePoint.y * height, blushRadius * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
  }, [cheekProperties, selectedCheekStyle, cheekMakeupEnabled]);

  // Main makeup drawing function
  const drawMakeup = useCallback((ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number) => {
    if (!landmarks || landmarks.length < 468) return;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw in optimal order
    drawCheeks(ctx, landmarks, width, height);
    drawLips(ctx, landmarks, width, height);
    drawEyes(ctx, landmarks, width, height);
  }, [drawCheeks, drawEyes, drawLips]);

  // Rendering loop
  useEffect(() => {
    if (!canvasRef.current || !displayVideoRef.current || !isVideoReady) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    if (displayVideoRef.current.videoWidth && displayVideoRef.current.videoHeight) {
      if (canvas.width !== displayVideoRef.current.videoWidth) {
        canvas.width = displayVideoRef.current.videoWidth;
      }
      if (canvas.height !== displayVideoRef.current.videoHeight) {
        canvas.height = displayVideoRef.current.videoHeight;
      }
    }
    
    const renderLoop = () => {
      const now = performance.now();
      
      frameCounter.current = (frameCounter.current + 1) % SKIP_FRAMES;
      if (frameCounter.current !== 0 && now - lastRenderTime.current < RENDER_INTERVAL) {
        animationRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      
      lastRenderTime.current = now;
      
      const faceLandmarks = detectionResults?.face?.faceLandmarks?.[0];
      
      if (faceLandmarks && faceLandmarks.length > 0) {
        drawMakeup(ctx, faceLandmarks, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      animationRef.current = requestAnimationFrame(renderLoop);
    };
    
    animationRef.current = requestAnimationFrame(renderLoop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isVideoReady, detectionResults, drawMakeup, RENDER_INTERVAL, SKIP_FRAMES]);

  // Apply preset looks function
  const applyPreset = useCallback((preset: string) => {
    switch (preset.toLowerCase()) {
      case "natural":
        setSelectedLookStyle("natural");
        setLookProperties({
          color: eyeColors[1].color,
          brightness: 0.4,
          intensity: 0.5,
          size: 0.05,
          shine: 0.3,
        });
        break;
        
      case "smokey":
        setSelectedLookStyle("smokey");
        setLookProperties({
          color: eyeColors[0].color,
          brightness: 0.5,
          intensity: 0.8,
          size: 0.07,
          shine: 0.4,
        });
        break;
        
      case "cat":
        setSelectedLookStyle("cat");
        setLookProperties({
          color: eyeColors[0].color,
          brightness: 0.6,
          intensity: 0.9,
          size: 0.08,
          shine: 0.2,
        });
        break;
        
      case "glitter":
        setSelectedLookStyle("glitter");
        setLookProperties({
          color: eyeColors[4].color,
          brightness: 0.6,
          intensity: 0.7,
          size: 0.06,
          shine: 0.95,
        });
        break;
        
      case "nude":
        setSelectedLookStyle("nude");
        setLookProperties({
          color: eyeColors[6].color,
          brightness: 0.3,
          intensity: 0.3,
          size: 0.03,
          shine: 0.1,
        });
        break;
    }
  }, []);

  // Reset function
  const handleReset = useCallback(() => {
    if (activeCategory === "looks") {
      setSelectedLookStyle("natural");
      setLookProperties({
        color: eyeColors[1].color,
        brightness: 0.4,
        intensity: 0.5,
        size: 0.05,
        shine: 0.3,
      });
    } else if (activeCategory === "lips") {
      setSelectedLipStyle("nude");
      setLipProperties({
        color: lipColors[3].color,
        brightness: 0.6,
        intensity: 0.5,
        size: 0.08,
        shine: 0.25,
      });
    } else if (activeCategory === "cheeks") {
      setSelectedCheekStyle("natural");
      setCheekProperties({
        color: cheekColors[0].color,
        brightness: 0.6,
        intensity: 0.5,
        size: 0.2,
        shine: 0.15,
      });
    }
  }, [activeCategory]);

  // Toggle makeup
  const toggleCurrentMakeup = useCallback(() => {
    if (activeCategory === "looks") {
      setEyeMakeupEnabled(prev => !prev);
    } else if (activeCategory === "lips") {
      setLipMakeupEnabled(prev => !prev);
    } else if (activeCategory === "cheeks") {
      setCheekMakeupEnabled(prev => !prev);
    }
  }, [activeCategory]);

  // Style gradients
  const styleGradients = {
    natural: "linear-gradient(135deg, #D2B48C, #F4A460)",
    smokey: "linear-gradient(135deg, #2C2C2C, #696969)",
    cat: "linear-gradient(135deg, #000000, #4B0082)",
    glitter: "linear-gradient(135deg, #8A2BE2, #DA70D6)",
    nude: "linear-gradient(135deg, #F5DEB3, #DEB887)",
    matte: "linear-gradient(135deg, #DC143C, #B22222)",
    glossy: "linear-gradient(135deg, #FF69B4, #FF1493)",
    ombre: "linear-gradient(135deg, #FFB6C1, #DC143C)",
    tint: "linear-gradient(135deg, #FFA07A, #FF6347)",
    blush: "linear-gradient(135deg, #FFB6C1, #FF69B4)",
    contour: "linear-gradient(135deg, #A0522D, #8B4513)",
    highlight: "linear-gradient(135deg, #FFFFFF, #F0F8FF)",
    bronzer: "linear-gradient(135deg, #CD853F, #D2691E)",
  };
  // Panel components
  const LooksPanel = () => {
    // Tách tab chọn style và chọn màu 
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-pink-600 mb-6">Eye Makeup</h2>
        
        {/* Tab cho style và color */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <StyleColorTab
            icon="🎨"
            label="Styles"
            isSelected={activeTab === "style"}
            onClick={() => setActiveTab("style")}
          />
          <StyleColorTab
            icon="🌈"
            label="Colors"
            isSelected={activeTab === "color"}
            onClick={() => setActiveTab("color")}
          />
        </div>
        
        {/* Nội dung tab */}
        {activeTab === "style" ? (
          // Tab Styles
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Eye Looks</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <StyleThumbnail 
                label="Natural" 
                gradient={styleGradients.natural} 
                isSelected={selectedLookStyle === "natural"} 
                onClick={() => applyPreset("natural")} 
              />
              <StyleThumbnail 
                label="Smokey" 
                gradient={styleGradients.smokey} 
                isSelected={selectedLookStyle === "smokey"} 
                onClick={() => applyPreset("smokey")} 
              />
              <StyleThumbnail 
                label="Cat Eyes" 
                gradient={styleGradients.cat} 
                isSelected={selectedLookStyle === "cat"} 
                onClick={() => applyPreset("cat")} 
              />
              <StyleThumbnail 
                label="Glitter" 
                gradient={styleGradients.glitter} 
                isSelected={selectedLookStyle === "glitter"} 
                onClick={() => applyPreset("glitter")} 
              />
              <StyleThumbnail 
                label="Nude" 
                gradient={styleGradients.nude} 
                isSelected={selectedLookStyle === "nude"} 
                onClick={() => applyPreset("nude")} 
              />
            </div>
          </>
        ) : (
          // Tab Colors
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Eye Color</h3>
            <div className="grid grid-cols-4 gap-3 mb-6 bg-gray-50 p-4 rounded-xl">
              {eyeColors.map((colorObj, index) => (
                <ColorButton
                  key={index}
                  colorName={colorObj.name}
                  value={colorObj.value}
                  isSelected={lookProperties.color === colorObj.color}
                  onClick={() => setLookProperties(prev => ({ ...prev, color: colorObj.color }))}
                />
              ))}
            </div>
          </>
        )}
        
        <div className="mt-8">
          <button
            onClick={toggleCurrentMakeup}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
              eyeMakeupEnabled 
                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105" 
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {eyeMakeupEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            {eyeMakeupEnabled ? "Eye Makeup ON" : "Eye Makeup OFF"}
          </button>
        </div>
      </div>
    );
  };

  const LipsPanel = () => {
    const lipStyles: Array<{ style: LipStyle; label: string; gradient: string }> = [
      { style: "nude", label: "Nude", gradient: styleGradients.nude },
      { style: "matte", label: "Matte", gradient: styleGradients.matte },
      { style: "glossy", label: "Glossy", gradient: styleGradients.glossy },
      { style: "tint", label: "Tint", gradient: styleGradients.tint },
      { style: "ombre", label: "Gradient", gradient: styleGradients.ombre },
    ];
    
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-pink-600 mb-6">Lip Makeup</h2>
        
        {/* Tab cho style và color */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <StyleColorTab
            icon="🎨"
            label="Styles"
            isSelected={activeTab === "style"}
            onClick={() => setActiveTab("style")}
          />
          <StyleColorTab
            icon="🌈"
            label="Colors"
            isSelected={activeTab === "color"}
            onClick={() => setActiveTab("color")}
          />
        </div>
        
        {/* Nội dung tab */}
        {activeTab === "style" ? (
          // Tab Styles
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Lip Style</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {lipStyles.map(({ style, label, gradient }) => (
                <StyleThumbnail
                  key={style}
                  label={label}
                  gradient={gradient}
                  isSelected={selectedLipStyle === style}
                  onClick={() => setSelectedLipStyle(style)}
                />
              ))}
            </div>
          </>
        ) : (
          // Tab Colors
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Lip Color</h3>
            <div className="grid grid-cols-4 gap-3 mb-6 bg-gray-50 p-4 rounded-xl">
              {lipColors.map((colorObj, index) => (
                <ColorButton
                  key={index}
                  colorName={colorObj.name}
                  value={colorObj.value}
                  isSelected={lipProperties.color === colorObj.color}
                  onClick={() => setLipProperties(prev => ({ ...prev, color: colorObj.color }))}
                />
              ))}
            </div>
          </>
        )}
        
        <div className="mt-8">
          <button
            onClick={toggleCurrentMakeup}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
              lipMakeupEnabled 
                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105" 
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {lipMakeupEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            {lipMakeupEnabled ? "Lip Makeup ON" : "Lip Makeup OFF"}
          </button>
        </div>
      </div>
    );
  };

  const CheeksPanel = () => {
    const cheekStyles: Array<{ style: CheekStyle; label: string; gradient: string }> = [
      { style: "natural", label: "Natural", gradient: styleGradients.blush },
      { style: "blush", label: "Blush", gradient: styleGradients.blush },
      { style: "contour", label: "Contour", gradient: styleGradients.contour },
      { style: "highlight", label: "Highlight", gradient: styleGradients.highlight },
      { style: "bronzer", label: "Bronzer", gradient: styleGradients.bronzer },
    ];
    
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-pink-600 mb-6">Cheek Makeup</h2>
        
        {/* Tab cho style và color */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <StyleColorTab
            icon="🎨"
            label="Styles"
            isSelected={activeTab === "style"}
            onClick={() => setActiveTab("style")}
          />
          <StyleColorTab
            icon="🌈"
            label="Colors"
            isSelected={activeTab === "color"}
            onClick={() => setActiveTab("color")}
          />
        </div>
        
        {/* Nội dung tab */}
        {activeTab === "style" ? (
          // Tab Styles
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Cheek Style</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {cheekStyles.map(({ style, label, gradient }) => (
                <StyleThumbnail
                  key={style}
                  label={label}
                  gradient={gradient}
                  isSelected={selectedCheekStyle === style}
                  onClick={() => setSelectedCheekStyle(style)}
                />
              ))}
            </div>
          </>
        ) : (
          // Tab Colors
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Cheek Color</h3>
            <div className="grid grid-cols-4 gap-3 mb-6 bg-gray-50 p-4 rounded-xl">
              {cheekColors.map((colorObj, index) => (
                <ColorButton
                  key={index}
                  colorName={colorObj.name}
                  value={colorObj.value}
                  isSelected={cheekProperties.color === colorObj.color}
                  onClick={() => setCheekProperties(prev => ({ ...prev, color: colorObj.color }))}
                />
              ))}
            </div>
          </>
        )}
        
        <div className="mt-8">
          <button
            onClick={toggleCurrentMakeup}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
              cheekMakeupEnabled 
                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105" 
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {cheekMakeupEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            {cheekMakeupEnabled ? "Cheek Makeup ON" : "Cheek Makeup OFF"}
          </button>
        </div>
      </div>
    );
  };

  // Get current panel
  const getCurrentPanel = () => {
    switch (activeCategory) {
      case "looks":
        return <LooksPanel />;
      case "lips":
        return <LipsPanel />;
      case "cheeks":
        return <CheeksPanel />;
      default:
        return <LooksPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-6">
      {/* Header */}
      <header className="bg-white shadow-lg py-4 px-6 rounded-xl mb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Ultra Precise AI Makeup Studio
          </h1>
          <div className="text-sm text-gray-600 font-medium">
            Professional precision with realistic effects
          </div>
        </div>
      </header>
      
      {/* Status Banner */}
      <StatusBanner message={statusMessage} progress={progress} />
      
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Video and Canvas Container */}
        <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="relative w-full" style={{ paddingTop: "75%" }}>
            {/* Video Element */}
            <video
              ref={displayVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            
            {/* Canvas Overlay for Makeup */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
              style={{ opacity: statusMessage.includes("Face not detected") ? 0 : 1 }}
            />
            
            {/* Face Not Detected Overlay */}
            {statusMessage.includes("Face not detected") && (
              <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40 flex flex-col items-center justify-center animate-pulse">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
                  <svg className="w-16 h-16 text-white mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6" />
                  </svg>
                  <p className="text-white text-2xl font-bold mb-2">Face not detected</p>
                  <p className="text-white/80 text-lg">Please position your face clearly in the frame</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Current Makeup Status */}
          <div className="p-4 flex flex-wrap justify-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100">
            <div 
              className={`py-2 px-4 rounded-full text-sm font-semibold transition-all duration-200 ${
                eyeMakeupEnabled 
                  ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md" 
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              Eyes: {eyeMakeupEnabled ? "ON" : "OFF"}
            </div>
            <div 
              className={`py-2 px-4 rounded-full text-sm font-semibold transition-all duration-200 ${
                lipMakeupEnabled 
                  ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md" 
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              Lips: {lipMakeupEnabled ? "ON" : "OFF"}
            </div>
            <div 
              className={`py-2 px-4 rounded-full text-sm font-semibold transition-all duration-200 ${
                cheekMakeupEnabled 
                  ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md" 
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              Cheeks: {cheekMakeupEnabled ? "ON" : "OFF"}
            </div>
          </div>
        </div>
        
        {/* Makeup Options Panel */}
        <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Category Tabs */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-gradient-to-r from-gray-50 to-gray-100">
            <CategoryTab
              icon="👁️"
              label="Eyes"
              isSelected={activeCategory === "looks"}
              onClick={() => {
                setActiveCategory("looks");
                // Reset to style tab when changing category
                setActiveTab("style");
              }}
            />
            <CategoryTab
              icon="👄"
              label="Lips"
              isSelected={activeCategory === "lips"}
              onClick={() => {
                setActiveCategory("lips");
                // Reset to style tab when changing category
                setActiveTab("style");
              }}
            />
            <CategoryTab
              icon="✨"
              label="Cheeks"
              isSelected={activeCategory === "cheeks"}
              onClick={() => {
                setActiveCategory("cheeks");
                // Reset to style tab when changing category
                setActiveTab("style");
              }}
            />
          </div>
          
          {/* Options Content - Scrollable Area */}
          <div className="h-[calc(75vh-200px)] overflow-y-auto custom-scrollbar">
            {getCurrentPanel()}
          </div>
          
          {/* Reset Button */}
          <div className="p-6 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 py-4 px-6 rounded-xl hover:from-gray-300 hover:to-gray-400 transition-all duration-200 font-semibold transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Reset to Natural Look
            </button>
          </div>
        </div>
      </div>
      
      {/* Ultra Precise Styles */}
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        .animate-slideIn {
          animation: slideIn 0.4s ease-out;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
        
        /* Ultra precise button interactions */
        button {
          outline: none;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        
        button:focus {
          outline: none;
        }
        
        button:hover {
          transition: all 0.2s ease-in-out;
        }
        
        button:active {
          transform: scale(0.98);
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #f9a8d4, #ec4899);
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #ec4899, #db2777);
        }
        
        @media (max-width: 768px) {
          .p-6 {
            padding: 1.5rem;
          }
          
          .text-2xl {
            font-size: 1.75rem;
          }
          
          .gap-6 {
            gap: 1.5rem;
          }
        }
        
        @media (max-width: 640px) {
          .w-14 {
            width: 4rem;
          }
          
          .h-14 {
            height: 4rem;
          }
          
          .min-h-\\[100px\\] {
            min-height: 120px;
          }
        }
        
        input[type="range"] {
          background: transparent;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        input[type="range"]::-webkit-slider-track {
          width: 100%;
          height: 12px;
          cursor: pointer;
          background: #e5e7eb;
          border-radius: 6px;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ec4899, #db2777);
          cursor: pointer;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          background: linear-gradient(135deg, #db2777, #be185d);
          transform: scale(1.15);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        }
        
        .shadow-xl {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        
        .shadow-lg {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        .transform {
          transform-origin: center;
        }
        
        .hover\\:scale-105:hover {
          transform: scale(1.05) translateZ(0);
        }
        
        .scale-105 {
          transform: scale(1.05) translateZ(0);
        }
        
        .ring-3 {
          box-shadow: 0 0 0 3px var(--tw-ring-color);
        }
        
        .ring-pink-500 {
          --tw-ring-color: rgb(236 72 153 / 0.5);
        }
        
        .ring-offset-2 {
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--tw-ring-color);
        }
        
        button:focus-visible {
          outline: 2px solid #ec4899;
          outline-offset: 2px;
        }
        
        input[type="range"]:focus {
          outline: none;
        }
        
        .bg-clip-text {
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }
        
        video {
          object-fit: cover;
          background: #000;
        }
        
        canvas {
          mix-blend-mode: normal;
          pointer-events: none;
        }
        
        @media (max-width: 1024px) {
          .lg\\:w-2\\/3 {
            width: 100%;
          }
          
          .lg\\:w-1\\/3 {
            width: 100%;
          }
          
          .lg\\:flex-row {
            flex-direction: column;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        html {
          scroll-behavior: smooth;
        }
        
        ::selection {
          background: rgba(236, 72, 153, 0.3);
          color: inherit;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }
        
        /* Perfect click responsiveness */
        button:not(:disabled):active {
          transform: scale(0.98);
          transition: transform 0.1s ease;
        }
        
        /* Enhanced touch support */
        @media (hover: none) and (pointer: coarse) {
          button:hover {
            transform: none;
          }
          
          button:active {
            transform: scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
