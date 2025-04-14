"use client";

import { RefObject } from "react";

interface AnalysisLayoutProps {
  title: string;
  description: string;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  result: string | null;
  error: string | null;
  selectionButtons?: JSX.Element;
  colorPalette?: JSX.Element;
  actionButtons?: JSX.Element;
  statusMessage?: string; // Thêm prop cho thông báo trạng thái
  progress?: number; // Thêm prop cho thanh tiến trình
}

export default function AnalysisLayout({
  title,
  description,
  videoRef,
  canvasRef,
  result,
  error,
  selectionButtons,
  colorPalette,
  actionButtons,
  statusMessage,
  progress,
}: AnalysisLayoutProps) {
  return (
    <div className="flex flex-col gap-8 min-h-[calc(100vh-2rem)] p-4 md:p-8 overflow-hidden bg-gradient-to-r from-pink-100 to-purple-100">
      {error && (
        <div className="absolute right-0 bg-red-500 text-white p-4 rounded-lg shadow-md text-center max-w-2xl mx-auto">
          {error}
        </div>
      )}
      {/* Hiển thị status message và progress bar */}
      {statusMessage && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white p-2 rounded-lg shadow-md">
          {statusMessage}
          {progress !== undefined && progress > 0 && (
            <div className="w-32 h-2 bg-gray-300 rounded mt-2">
              <div
                className="h-full bg-green-500 rounded"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 flex-1 overflow-hidden">
        {/* Phần video live (2/3) */}
        <div className="md:w-2/3 p-4 md:p-6 rounded-xl flex flex-row items-center">
          <div className="relative max-w-[480px] aspect-[9/16] mx-auto rounded-2xl overflow-hidden shadow-lg border-4 border-gray-200">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="inset-0 w-full h-full object-contain pointer-events-none"
            />
          </div>
          {selectionButtons && (
            <div className="flex flex-col gap-6 ml-6">
              {selectionButtons}
            </div>
          )}
        </div>

        {/* Phần kết quả (1/3) */}
        <div className="md:w-1/3 bg-white p-4 md:p-6 rounded-xl shadow-md flex flex-col">
          <div className="mb-4">
            <h5 className="text-2xl md:text-3xl font-bold text-pink-600">{title}</h5>
            <p className="text-sm md:text-base text-gray-500 mt-2">{description}</p>
          </div>
          <hr className="border-gray-200 mb-4" />
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-4">Analysis Result</h2>
          {result ? (
            <p className="text-lg md:text-xl text-gray-700 mb-4">
              Your result is <span className="font-bold text-pink-600">{result}</span>.
            </p>
          ) : (
            <p className="text-lg md:text-xl text-gray-500 animate-pulse mb-4">
              Waiting for analysis...
            </p>
          )}
          {colorPalette && (
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-4">
                Color Palette
              </h3>
              {colorPalette}
            </div>
          )}
          {actionButtons && (
            <div className="mt-4 flex flex-col gap-4">
              {actionButtons}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}