import React, { useEffect, useRef } from "react";
import { useHandControl } from "../context/HandControlContext";

export const TouchableButton = React.memo(
  ({
    label,
    onClick,
    onHover,
    className,
    style,
  }: {
    label: string;
    onClick: () => void;
    onHover?: () => void;
    className?: string;
    style?: React.CSSProperties;
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
        className={className ? className : "touchable-button"}
        onClick={() => onClick()}
        onMouseOver={() => onHover && onHover()}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </button>
    );
  }
);
