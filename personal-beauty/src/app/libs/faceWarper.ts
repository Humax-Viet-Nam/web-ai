/**
 * Interface for facial landmark point
 */
export interface NormalizedLandmark {
  x: number;
  y: number;
}

/**
 * Interface for warping parameters
 */
export interface WarpingParameters {
  noseSize: number; // -100 to 100 (percentage)
  noseHeight: number; // -100 to 100 (percentage)
  cheekSize: number; // -100 to 100 (percentage)
  chinWidth: number; // -100 to 100 (percentage)
  chinHeight: number; // -100 to 100 (percentage)
}

/**
 * Default warping parameters
 */
export const DEFAULT_WARPING_PARAMS: WarpingParameters = {
  noseSize: 0,
  noseHeight: 0,
  cheekSize: 0,
  chinWidth: 0,
  chinHeight: 0,
};

interface FeatureRegion {
  center: { x: number; y: number };
  radius: number;
  intensity?: number;
  verticalIntensity?: number;
  horizontalIntensity?: number;
}

interface FacialFeatures {
  [key: string]: FeatureRegion;
}

/**
 * FaceWarper class for modifying facial features
 */
export class FaceWarper {
  private landmarks: NormalizedLandmark [];
  private originalImageData: ImageData | null = null;
  private imageWidth: number;
  private imageHeight: number;
  private params: WarpingParameters = { ...DEFAULT_WARPING_PARAMS };

  // Landmark indices for different facial features
  private readonly FACIAL_FEATURES = {
    // Nose landmarks
    nose: [
      1, 2, 3, 4, 5, 6, 168, 197, 195, 5, 4, 45, 220, 115, 114, 189, 188, 128,
      245, 344, 278,
    ],
    noseTip: 4,
    noseBridge: [168, 6, 197, 195, 5, 4],
    nostrils: [
      79, 166, 75, 77, 90, 180, 62, 78, 215, 305, 290, 392, 308, 415, 324, 405,
    ],

    // Cheek landmarks
    leftCheek: 117,
    rightCheek: 347,
    cheeks: [
      117, 118, 119, 120, 121, 347, 348, 349, 350, 351, 123, 147, 187, 207, 127,
      162, 354, 376, 433,
    ],

    // Chin landmarks
    chin: [152, 175, 199, 200, 201, 208, 428, 429, 430, 431, 432, 433, 434],
    chinCenter: 199,

    // Face outline
    faceOval: [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
      378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
      162, 21, 54, 103, 67, 109,
    ],
  };

  /**
   * Constructor for FaceWarper
   * @param landmarks Array of facial landmarks from MediaPipe Face Mesh
   * @param width Width of the image
   * @param height Height of the image
   */
  constructor(landmarks: NormalizedLandmark [], width: number, height: number) {
    this.landmarks = landmarks;
    this.imageWidth = width;
    this.imageHeight = height;
  }

  /**
   * Set warping parameters
   * @param params Warping parameters
   */
  public setParameters(params: Partial<WarpingParameters>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Reset warping parameters to default
   */
  public resetParameters(): void {
    this.params = { ...DEFAULT_WARPING_PARAMS };
  }

  /**
   * Store the original image data for warping
   * @param imageData Original image data
   */
  public setOriginalImageData(imageData: ImageData): void {
    this.originalImageData = imageData;
  }

  /**
   * Apply warping to the image and draw on the provided context
   * @param ctx Canvas context to draw the warped image on
   * @returns True if warping was successful, false otherwise
   */
  public applyWarping(ctx: CanvasRenderingContext2D): ImageData | null {
    if (!this.originalImageData) {
      console.error(
        "Original image data not set. Call setOriginalImageData() first."
      );
      return null;
    }

    // Create a new ImageData for the warped image
    const warpedImageData = ctx.createImageData(
      this.imageWidth,
      this.imageHeight
    );

    // Normalize parameters to -0.5 to 0.5 range for warping algorithm
    const normalizedParams = this.normalizeParameters();

    // Define feature regions for warping
    const featureRegions = this.defineFeatureRegions(normalizedParams);

    // Apply warping
    this.warpImage(this.originalImageData, warpedImageData, featureRegions);

    return warpedImageData;
  }

  /**
   * Normalize parameters from -100 to 100 range to -0.5 to 0.5 range
   */
  private normalizeParameters(): WarpingParameters {
    return {
      noseSize: this.params.noseSize / 200,
      noseHeight: this.params.noseHeight / 200,
      cheekSize: this.params.cheekSize / 200,
      chinWidth: this.params.chinWidth / 200,
      chinHeight: this.params.chinHeight / 200,
    };
  }

  /**
   * Define feature regions for warping based on landmarks
   * @param params Normalized warping parameters
   */
  private defineFeatureRegions(params: WarpingParameters): FacialFeatures {
    return {
      nose: {
        center: this.getLandmarkCoordinates(this.FACIAL_FEATURES.noseTip),
        radius: this.imageWidth * 0.05,
        horizontalIntensity: params.noseSize,
        verticalIntensity: params.noseHeight,
      },
      leftCheek: {
        center: this.getLandmarkCoordinates(this.FACIAL_FEATURES.leftCheek),
        radius: this.imageWidth * 0.1,
        intensity: params.cheekSize,
      },
      rightCheek: {
        center: this.getLandmarkCoordinates(this.FACIAL_FEATURES.rightCheek),
        radius: this.imageWidth * 0.1,
        intensity: params.cheekSize,
      },
      chin: {
        center: this.getLandmarkCoordinates(this.FACIAL_FEATURES.chinCenter),
        radius: this.imageWidth * 0.1,
        horizontalIntensity: params.chinWidth,
        verticalIntensity: params.chinHeight,
      },
    };
  }

  /**
   * Get coordinates for a specific landmark
   * @param index Index of the landmark
   */
  private getLandmarkCoordinates(index: number): { x: number; y: number } {
    if (!this.landmarks || !this.landmarks[index]) {
      throw new Error(`Landmark at index ${index} not found`);
    }

    return {
      x: this.landmarks[index].x * this.imageWidth,
      y: this.landmarks[index].y * this.imageHeight,
    };
  }

  /**
   * Apply warping to the image
   * @param sourceData Source image data
   * @param targetData Target image data
   * @param features Facial feature regions
   */
  private warpImage(
    sourceData: ImageData,
    targetData: ImageData,
    features: FacialFeatures
  ): void {
    const sourcePixels = sourceData.data;
    const targetPixels = targetData.data;
    const width = this.imageWidth;
    const height = this.imageHeight;

    // Apply warping for each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Initialize source coordinates to current pixel
        let srcX = x;
        let srcY = y;
        let totalWarpFactorX = 0;
        let totalWarpFactorY = 0;
        let totalWeight = 0;

        // Apply warping from each feature
        for (const [feature, props] of Object.entries(features)) {
          const dx = x - props.center.x;
          const dy = y - props.center.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Only apply effect within the feature's radius of influence
          if (distance < props.radius * 2) {
            // Calculate weight based on distance (closer = stronger effect)
            const weight = Math.pow(
              1 - Math.min(1, distance / (props.radius * 2)),
              2
            );

            // Different warping for different features
            let warpX = 0;
            let warpY = 0;

            if (feature === "nose") {
              // Nose size and height adjustments
              warpX = dx * (props.horizontalIntensity || 0) * weight;
              warpY = dy * (props.verticalIntensity || 0) * weight;
            } else if (feature === "leftCheek") {
              // Left cheek size adjustment (inward/outward)
              warpX = dx * (props.intensity || 0) * weight * -1; // Negative for left cheek
              warpY = 0;
            } else if (feature === "rightCheek") {
              // Right cheek size adjustment (inward/outward)
              warpX = dx * (props.intensity || 0) * weight; // Positive for right cheek
              warpY = 0;
            } else if (feature === "chin") {
              // Chin width and height adjustments
              warpX = dx * (props.horizontalIntensity || 0) * weight;
              warpY = dy * (props.verticalIntensity || 0) * weight;

              // Extra vertical adjustment for chin height
              if (y > props.center.y) {
                warpY *= 1.5; // Stronger effect on the bottom part of chin
              }
            }

            totalWarpFactorX += warpX;
            totalWarpFactorY += warpY;
            totalWeight += weight;
          }
        }

        // Apply combined warping if any feature affected this pixel
        if (totalWeight > 0) {
          srcX = x - totalWarpFactorX;
          srcY = y - totalWarpFactorY;
        }

        // Ensure source coordinates are within bounds
        srcX = Math.max(0, Math.min(width - 1, srcX));
        srcY = Math.max(0, Math.min(height - 1, srcY));

        // Bilinear interpolation for smoother results
        this.applyBilinearInterpolation(
          sourcePixels,
          targetPixels,
          x,
          y,
          srcX,
          srcY,
          width
        );
      }
    }
  }

  /**
   * Apply bilinear interpolation for a pixel
   * @param sourceData Source image data
   * @param targetData Target image data
   * @param targetX Target x coordinate
   * @param targetY Target y coordinate
   * @param sourceX Source x coordinate
   * @param sourceY Source y coordinate
   * @param width Image width
   */
  private applyBilinearInterpolation(
    sourceData: Uint8ClampedArray,
    targetData: Uint8ClampedArray,
    targetX: number,
    targetY: number,
    sourceX: number,
    sourceY: number,
    width: number
  ): void {
    const srcX1 = Math.floor(sourceX);
    const srcY1 = Math.floor(sourceY);
    const srcX2 = Math.min(srcX1 + 1, this.imageWidth - 1);
    const srcY2 = Math.min(srcY1 + 1, this.imageHeight - 1);

    const xWeight = sourceX - srcX1;
    const yWeight = sourceY - srcY1;

    const index = (targetY * width + targetX) * 4;
    const index11 = (srcY1 * width + srcX1) * 4;
    const index12 = (srcY1 * width + srcX2) * 4;
    const index21 = (srcY2 * width + srcX1) * 4;
    const index22 = (srcY2 * width + srcX2) * 4;

    // Interpolate color channels (R, G, B, A)
    for (let i = 0; i < 4; i++) {
      const top =
        sourceData[index11 + i] * (1 - xWeight) +
        sourceData[index12 + i] * xWeight;
      const bottom =
        sourceData[index21 + i] * (1 - xWeight) +
        sourceData[index22 + i] * xWeight;
      targetData[index + i] = Math.round(
        top * (1 - yWeight) + bottom * yWeight
      );
    }
  }

  /**
   * Draw facial landmarks on a canvas for visualization
   * @param ctx Canvas context to draw on
   * @param showLabels Whether to show feature labels
   */
  public drawFaceMesh(
    ctx: CanvasRenderingContext2D,
    showLabels: boolean = false
  ): void {
    // Define colors for different facial features
    const featureColors: { [key: string]: string } = {
      nose: "#0000FF",
      nostrils: "#FF00FF",
      cheeks: "#00FF00",
      chin: "#FF0000",
      faceOval: "rgba(255, 255, 0, 0.5)",
    };

    // Draw points for each feature
    for (const [feature, indices] of Object.entries(this.FACIAL_FEATURES)) {
      if (Array.isArray(indices)) {
        ctx.fillStyle = featureColors[feature] || "#FFFFFF";

        for (const idx of indices) {
          const x = this.landmarks[idx].x * this.imageWidth;
          const y = this.landmarks[idx].y * this.imageHeight;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Connect points for face oval
        if (feature === "faceOval") {
          ctx.strokeStyle = featureColors[feature];
          ctx.lineWidth = 1;
          ctx.beginPath();

          for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const x = this.landmarks[idx].x * this.imageWidth;
            const y = this.landmarks[idx].y * this.imageHeight;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // Draw feature labels if requested
    if (showLabels) {
      ctx.font = "14px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 0.5;

      // Label nose
      const nose = this.getLandmarkCoordinates(this.FACIAL_FEATURES.noseTip);
      ctx.fillText("Nose", nose.x + 10, nose.y);
      ctx.strokeText("Nose", nose.x + 10, nose.y);

      // Label cheeks
      const leftCheek = this.getLandmarkCoordinates(
        this.FACIAL_FEATURES.leftCheek
      );
      ctx.fillText("Left Cheek", leftCheek.x - 80, leftCheek.y);
      ctx.strokeText("Left Cheek", leftCheek.x - 80, leftCheek.y);

      const rightCheek = this.getLandmarkCoordinates(
        this.FACIAL_FEATURES.rightCheek
      );
      ctx.fillText("Right Cheek", rightCheek.x + 10, rightCheek.y);
      ctx.strokeText("Right Cheek", rightCheek.x + 10, rightCheek.y);

      // Label chin
      const chin = this.getLandmarkCoordinates(this.FACIAL_FEATURES.chinCenter);
      ctx.fillText("Chin", chin.x - 15, chin.y + 20);
      ctx.strokeText("Chin", chin.x - 15, chin.y + 20);
    }
  }
}
