/**
 * Interface for facial landmark point
 */
export interface NormalizedLandmark {
  x: number;
  y: number;
}

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

const goldenRatio = 1.612;

export const IDEAL_RATIOS = {
  noseWidthPerFaceWidth: 0.34,
  mouthWidthPerNoseWidth: goldenRatio,
  eyeDistancePerEyeWidth: goldenRatio,
  faceHeightPerFaceWidth: goldenRatio,
  noseHeightPerFaceHeight: 0.33,
  foreheadHeightPerFaceHeight: 0.33,
  chinHeightPerFaceHeight: 0.33,
};

/**
 * Interface for warping parameters
 */
export interface WarpingParameters {
  // foreheadWidthAdjustment: number;
  foreheadHeightAdjustment: number | null;
  eyeDistanceAdjustment: number | null;
  // eyeWidthAdjustment: number | null;
  noseWidthAdjustment: number | null;
  noseHeightAdjustment: number | null;
  // chinWidthAdjustment: number | null;
  chinHeightAdjustment: number | null;
  // mouthWidthAdjustment: number | null;
}

/**
 * Default warping parameters
 */
export const DEFAULT_WARPING_PARAMS: WarpingParameters = {
  // foreheadWidthAdjustment: 0,
  foreheadHeightAdjustment: 0,
  eyeDistanceAdjustment: 0,
  // eyeWidthAdjustment: 0,
  noseWidthAdjustment: 0,
  noseHeightAdjustment: 0,
  // chinWidthAdjustment: 0,
  chinHeightAdjustment: 0,
  // mouthWidthAdjustment: 0,
};

// Utility types
export type WarpingFeedback = Record<string, number | string | null>;

export interface FeatureRegion {
  center: { x: number; y: number };
  radius: number;
  intensity?: number;
  verticalIntensity?: number;
  horizontalIntensity?: number;
}

export interface FacialFeatures {
  [key: string]: FeatureRegion;
}

/**
 * FaceWarper class for modifying facial features
 */
export class FaceWarper {
  private landmarks: NormalizedLandmark[];
  private originalImageData: ImageData | null = null;
  private imageWidth: number;
  private imageHeight: number;
  private params: WarpingParameters = { ...DEFAULT_WARPING_PARAMS };

  // Landmark indices for different facial features
  private static readonly FACIAL_FEATURES = {
    nose: [
      1, 2, 3, 4, 5, 6, 168, 197, 195, 5, 4, 45, 220, 115, 114, 189, 188, 128,
      245, 344, 278,
    ],
    noseTip: 4,
    noseBridge: [168, 6, 197, 195, 5, 4],
    nostrils: [
      79, 166, 75, 77, 90, 180, 62, 78, 215, 305, 290, 392, 308, 415, 324, 405,
    ],
    leftCheek: 192,
    rightCheek: 416,
    cheeks: [
      117, 118, 119, 120, 121, 347, 348, 349, 350, 351, 123, 147, 187, 207, 127,
      162, 354, 376, 433,
    ],
    chin: [152, 175, 199, 200, 201, 208, 428, 429, 430, 431, 432, 433, 434],
    chinCenter: 199,
    faceOval: [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
      378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
      162, 21, 54, 103, 67, 109,
    ],
    mouthWidth: [61, 308],
    noseWidth: [48, 278],
    foreHeadWidth: [54, 284],
    jewWidth: [136, 365],
  };

  /**
   * Constructor for FaceWarper
   * @param landmarks Array of facial landmarks from MediaPipe Face Mesh
   * @param width Width of the image
   * @param height Height of the image
   */
  constructor(landmarks: NormalizedLandmark[], width: number, height: number) {
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
      foreheadHeightAdjustment:
        (this.params.foreheadHeightAdjustment || 0) / 200,
      eyeDistanceAdjustment: (this.params.eyeDistanceAdjustment || 0) / 200,
      noseWidthAdjustment: (this.params.noseWidthAdjustment || 0) / 200,
      noseHeightAdjustment: (this.params.noseHeightAdjustment || 0) / 200,
      // chinWidthAdjustment: this.params.chinWidthAdjustment / 200,
      chinHeightAdjustment: (this.params.chinHeightAdjustment || 0) / 200,
    };
  }

  /**
   * Define feature regions for warping
   * based on landmarks
   * @param params Normalized warping parameters
   */
  private defineFeatureRegions(params: WarpingParameters): FacialFeatures {
    return {
      nose: {
        center: this.getLandmarkCoordinates(FaceWarper.FACIAL_FEATURES.noseTip),
        radius: this.imageWidth * 0.05,
        verticalIntensity: params.noseHeightAdjustment || 0,
      },
      chin: {
        center: this.getLandmarkCoordinates(
          FaceWarper.FACIAL_FEATURES.chinCenter
        ),
        radius: this.imageWidth * 0.1,
        // horizontalIntensity: params.chinWidthAdjustment,
        verticalIntensity: params.chinHeightAdjustment || 0,
      },
      forehead: {
        center: {
          x:
            (this.getLandmarkCoordinates(10).x +
              this.getLandmarkCoordinates(152).x) /
            2,
          y: this.getLandmarkCoordinates(10).y,
        },
        radius: this.imageWidth * 0.15,
        verticalIntensity: params.foreheadHeightAdjustment || 0,
      },
      eyes: {
        center: {
          x:
            (this.getLandmarkCoordinates(133).x +
              this.getLandmarkCoordinates(362).x) /
            2,
          y:
            (this.getLandmarkCoordinates(133).y +
              this.getLandmarkCoordinates(362).y) /
            2,
        },
        radius: this.imageWidth * 0.15,
        horizontalIntensity: params.eyeDistanceAdjustment || 0,
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
            } else if (feature === "chin") {
              // Chin width and height adjustments
              warpX = dx * (props.horizontalIntensity || 0) * weight;
              warpY = dy * (props.verticalIntensity || 0) * weight;

              // Extra vertical adjustment for chin height
              if (y > props.center.y) {
                warpY *= 1.5; // Stronger effect on the bottom part of chin
              }
            } else if (feature === "forehead") {
              // Forehead height adjustment
              if (props.verticalIntensity) {
                warpY = dy * props.verticalIntensity * weight;
              }
            } else if (feature === "eyes") {
              // Eye distance adjustment
              if (props.horizontalIntensity) {
                // Apply horizontal stretching/compression
                // Positive: move eyes apart, Negative: move eyes closer
                const eyeCenter = props.center.x;
                const direction = x < eyeCenter ? -1 : 1;
                warpX =
                  Math.abs(dx) * props.horizontalIntensity * direction * weight;
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

  private distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  private clamp(value: number, min = -100, max = 100): number {
    return Math.max(min, Math.min(max, value));
  }

  private getDeviation(actual: number, ideal: number): number | null {
    const deviation = this.clamp((actual / ideal - 1) * -100);
    if (Math.abs(deviation) < 5) {
      return null;
    }
    return deviation;
  }

  public calculateWarpingParametersWithFeedback(): AnalyzedResult &
    WarpingParameters {
    const lm = this.landmarks;

    // 1. Chiều rộng mũi / chiều rộng khuôn mặt
    const noseWidth = this.distance(lm[48], lm[278]);
    const faceWidth = this.distance(lm[234], lm[454]);
    const noseWidthPerFaceWidth = noseWidth / faceWidth;

    // 2. Chiều rộng miệng / chiều rộng mũi
    const mouthWidth = this.distance(lm[61], lm[291]);
    // const mouthWidthPerNoseWidth = mouthWidth / noseWidth;

    // 3. Khoảng cách giữa 2 mắt / trung bình chiều rộng mắt
    const eyeDistance = this.distance(lm[133], lm[362]);
    const leftEyeWidth = this.distance(lm[33], lm[133]);
    const rightEyeWidth = this.distance(lm[362], lm[263]);
    const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
    const eyeWidth = avgEyeWidth;
    const eyeDistancePerEyeWidth = eyeDistance / avgEyeWidth;

    // 4. Chiều dài khuôn mặt / chiều rộng khuôn mặt
    const faceHeight = this.distance(this.topPoint, lm[152]);
    const faceHeightPerFaceWidth = faceHeight / faceWidth;

    // 5. Chiều dài mũi / chiều dài khuôn mặt
    // 6. Tỷ lệ trán:mũi:cằm (1:1:1)
    const foreheadHeight = this.distance(this.topPoint, lm[9]);
    const noseHeight = this.distance(lm[9], lm[2]);
    const chinHeight = this.distance(lm[2], lm[152]);

    const foreheadHeightPerFaceHeight = foreheadHeight / faceHeight;
    const chinHeightPerFaceHeight = chinHeight / faceHeight;
    const noseHeightPerFaceHeight = noseHeight / faceHeight;

    const foreheadHeightAdjustment = this.getDeviation(
      foreheadHeightPerFaceHeight,
      IDEAL_RATIOS.foreheadHeightPerFaceHeight
    );
    const eyeDistanceAdjustment = this.getDeviation(
      eyeDistancePerEyeWidth,
      IDEAL_RATIOS.eyeDistancePerEyeWidth
    );
    const noseWidthAdjustment = this.getDeviation(
      noseWidthPerFaceWidth,
      IDEAL_RATIOS.noseWidthPerFaceWidth
    );
    const noseHeightAdjustment = this.getDeviation(
      noseHeightPerFaceHeight,
      IDEAL_RATIOS.noseHeightPerFaceHeight
    );
    // const chinWidthAdjustment = this.getDeviation(
    //   mouthWidthPerNoseWidth,
    //   IDEAL_RATIOS.mouthWidthPerNoseWidth
    // );

    const chinHeightAdjustment = this.getDeviation(
      chinHeightPerFaceHeight,
      IDEAL_RATIOS.chinHeightPerFaceHeight
    );

    return {
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
      foreheadHeightAdjustment,
      eyeDistanceAdjustment,
      noseWidthAdjustment,
      noseHeightAdjustment,
      // chinWidthAdjustment,
      chinHeightAdjustment,
    };
  }

  private get topPoint(): NormalizedLandmark {
    const midpoint = {
      x: (this.landmarks[105].x + this.landmarks[334].x) / 2,
      y: (this.landmarks[105].y + this.landmarks[334].y) / 2,
    };
    return {
      x: 2 * this.landmarks[10].x - midpoint.x,
      y: 2 * this.landmarks[10].y - midpoint.y,
    };
  }
}
