import React, { useEffect, useRef } from "react";
import { useHandControl } from "../context/HandControlContext";

export const SelectionButton = React.memo(
  ({
    area,
    selectedArea,
    setSelectedArea,
    label,
  }: {
    area: string;
    label: string;
    selectedArea: string | null;
    setSelectedArea: (area: string) => void;
  }) => {
    const { registerElement, unregisterElement, isHandDetectionEnabled } =
      useHandControl();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isRegistered = useRef(false);
    useEffect(() => {
      const button = buttonRef.current;
      if (!button) return;

      if (isHandDetectionEnabled && !isRegistered.current) {
        button.classList.add("hoverable");
        registerElement(button);
        isRegistered.current = true;
      } else if (!isHandDetectionEnabled && isRegistered.current) {
        button.classList.remove("hoverable");
        unregisterElement(button);
        isRegistered.current = false;
      }

      return () => {
        if (isRegistered.current && button) {
          button.classList.remove("hoverable");
          unregisterElement(button);
          isRegistered.current = false;
        }
      };
    }, [registerElement, unregisterElement, isHandDetectionEnabled]);

    return (
      <button
        ref={buttonRef}
        className={`area-button text-2xl min-h-[123px] font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform shadow-lg ${
          selectedArea === area
            ? "bg-pink-600 text-white scale-105 border-4 border-pink-300"
            : "bg-gray-200 text-gray-800 hover:bg-gray-300 hover:scale-105"
        }`}
        data-area={area}
        onClick={() => setSelectedArea(area)}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </button>
    );
  }
);
