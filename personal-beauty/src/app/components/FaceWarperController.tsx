import React, { memo, useEffect, useMemo } from "react";
import { useHandControl } from "../context/HandControlContext";
import { TouchableButton } from "./TouchableButton";
import { WarpingParameters } from "../libs/faceWarper";


export const FaceWarpingControllers = memo(
  ({
    faceWarpingValues,
    setFaceWarpingValues,
  }: {
    faceWarpingValues: WarpingParameters;
    setFaceWarpingValues: React.Dispatch<
      React.SetStateAction<WarpingParameters>
    >;
  }) => {
    const { registerElement, unregisterElement, isHandDetectionEnabled } =
      useHandControl();

    useEffect(() => {
      for (const key in faceWarpingValues) {
        const container = document.querySelector(
          `face-warping-control-button-${key}`
        );
        if (!container) return;

        if (isHandDetectionEnabled) {
          container.classList.add("hoverable");
          registerElement(container);
        } else {
          container.classList.remove("hoverable");
          unregisterElement(container);
        }

        return () => {
          container.classList.remove("hoverable");
          unregisterElement(container);
        };
      }
    }, []);
    const handleChange = (field: keyof WarpingParameters, value: number) => {
      console.log(`Changing ${field} to ${value}`);
      const clampedValue = Math.min(Math.max(value, -100), 100);
      setFaceWarpingValues((prev) => ({ ...prev, [field]: clampedValue }));
    };

    const NumberInput = (field: keyof WarpingParameters, label: string) =>
      useMemo(() => {
        return (
          <div className="flex flex-col gap-2">
            <label className="text-sm" htmlFor={`${field}-input`}>
              {label}
            </label>
            <div className="flex items-center gap-2 w-full">
              <TouchableButton
                className="px-12 py-10 bg-pink-600 rounded text-white font-bold hover:cursor-pointer face-warping-control-button"
                onClick={() =>
                  handleChange(field, (faceWarpingValues[field] || 0) - 1)
                }
                label="-"
              />
              <input
                type="number"
                min="-100"
                max="100"
                value={faceWarpingValues[field] || 0}
                id={`${field}-input`}
                className="w-full text-center border rounded p-9 text-3xl border-pink-400"
                onChange={(e) =>
                  handleChange(field, parseInt(e.target.value) || 0)
                }
              />
              <TouchableButton
                className="px-12 py-10 bg-pink-600 rounded text-white font-bold hover:cursor-pointer face-warping-control-button"
                onClick={() =>
                  handleChange(field, (faceWarpingValues[field] || 0) + 1)
                }
                label="+"
              />
            </div>
          </div>
        );
      }, [faceWarpingValues]);

    return (
      <div className="text-gray-800 font-bold">
        <div className="flex flex-col gap-4">
          {NumberInput("noseWidthAdjustment", "Nose Width Adjustment")}
          {NumberInput("eyeDistanceAdjustment", "Eye Distance Adjustment")}
          {NumberInput("foreheadHeightAdjustment", "Forehead Height Adjustment")}
          {NumberInput("chinHeightAdjustment", "Chin Height Adjustment")}
        </div>
      </div>
    );
  }
);

FaceWarpingControllers.displayName = "FaceWarpingControllers";
