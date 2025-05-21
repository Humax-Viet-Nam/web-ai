/**
 * Interface for facial landmark point
 */
export interface NormalizedLandmark {
  x: number
  y: number
}

/**
 * Interface for warping parameters
 */
export interface WarpingParameters {
  noseSize: number // -100 to 100 (percentage)
  noseHeight: number // -100 to 100 (percentage)
  cheekSize: number // -100 to 100 (percentage)
  chinWidth: number // -100 to 100 (percentage)
  chinHeight: number // -100 to 100 (percentage)
  nostrilWidth: number // -100 to 100 (percentage)
  mouthSize: number // -100 to 100 (percentage)
  mouthWidth: number // -100 to 100 (percentage)
  noseWidth: number // -100 to 100 (percentage)
  foreheadHeight: number // -100 to 100 (percentage)
  eyeDistance: number // -100 to 100 (percentage)
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
  nostrilWidth: 0,
  mouthSize: 0,
  mouthWidth: 0,
  noseWidth: 0,
  foreheadHeight: 0,
  eyeDistance: 0,
}

type WarpingFeedback = {
  [key: string]: number | string | null
}

interface FeatureRegion {
  center: { x: number; y: number }
  radius: number
  intensity?: number
  verticalIntensity?: number
  horizontalIntensity?: number
}

interface FacialFeatures {
  [key: string]: FeatureRegion
}

/**
 * FaceWarper class for modifying facial features
 */
export class FaceWarper {
  private landmarks: NormalizedLandmark[]
  private originalImageData: ImageData | null = null
  private imageWidth: number
  private imageHeight: number
  private params: WarpingParameters = { ...DEFAULT_WARPING_PARAMS }

  // Landmark indices for different facial features
  private readonly FACIAL_FEATURES = {
    // Nose landmarks
    nose: [1, 2, 3, 4, 5, 6, 168, 197, 195, 5, 4, 45, 220, 115, 114, 189, 188, 128, 245, 344, 278],
    noseTip: 4,
    noseBridge: [168, 6, 197, 195, 5, 4],
    nostrils: [79, 166, 75, 77, 90, 180, 62, 78, 215, 305, 290, 392, 308, 415, 324, 405],

    // Cheek landmarks
    leftCheek: 192,
    rightCheek: 416,
    cheeks: [117, 118, 119, 120, 121, 347, 348, 349, 350, 351, 123, 147, 187, 207, 127, 162, 354, 376, 433],

    // Chin landmarks
    chin: [152, 175, 199, 200, 201, 208, 428, 429, 430, 431, 432, 433, 434],
    chinCenter: 199,

    // Face outline
    faceOval: [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150,
      136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    ],

    mouthWidth: [61, 308],
    noseWidth: [48, 278],
    foreHeadWidth: [54, 284],
    jewWidth: [136, 365],
  }

  /**
   * Constructor for FaceWarper
   * @param landmarks Array of facial landmarks from MediaPipe Face Mesh
   * @param width Width of the image
   * @param height Height of the image
   */
  constructor(landmarks: NormalizedLandmark[], width: number, height: number) {
    this.landmarks = landmarks
    this.imageWidth = width
    this.imageHeight = height
  }

  /**
   * Set warping parameters
   * @param params Warping parameters
   */
  public setParameters(params: Partial<WarpingParameters>): void {
    this.params = { ...this.params, ...params }
  }

  /**
   * Reset warping parameters to default
   */
  public resetParameters(): void {
    this.params = { ...DEFAULT_WARPING_PARAMS }
  }

  /**
   * Store the original image data for warping
   * @param imageData Original image data
   */
  public setOriginalImageData(imageData: ImageData): void {
    this.originalImageData = imageData
  }

  /**
   * Apply warping to the image and draw on the provided context
   * @param ctx Canvas context to draw the warped image on
   * @returns True if warping was successful, false otherwise
   */
  public applyWarping(ctx: CanvasRenderingContext2D): ImageData | null {
    if (!this.originalImageData) {
      console.error("Original image data not set. Call setOriginalImageData() first.")
      return null
    }

    // Create a new ImageData for the warped image
    const warpedImageData = ctx.createImageData(this.imageWidth, this.imageHeight)

    // Normalize parameters to -0.5 to 0.5 range for warping algorithm
    const normalizedParams = this.normalizeParameters()

    // Define feature regions for warping
    const featureRegions = this.defineFeatureRegions(normalizedParams)
    console.log("Feature regions:", featureRegions)

    // Apply warping
    this.warpImage(this.originalImageData, warpedImageData, featureRegions)

    return warpedImageData
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
      nostrilWidth: this.params.nostrilWidth / 200,
      mouthSize: this.params.mouthSize / 200,
      mouthWidth: this.params.mouthWidth / 200,
      noseWidth: this.params.noseWidth / 200,
      foreheadHeight: this.params.foreheadHeight / 200,
      eyeDistance: this.params.eyeDistance / 200,
    }
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
        // horizontalIntensity: params.noseWidth,
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
      leftNostril: {
        center: this.getLandmarkCoordinates(79), // Left nostril
        radius: this.imageWidth * 0.03,
        intensity: params.nostrilWidth + params.noseWidth * 0.5,
      },
      rightNostril: {
        center: this.getLandmarkCoordinates(309), // Right nostril
        radius: this.imageWidth * 0.03,
        intensity: params.nostrilWidth + params.noseWidth * 0.5,
      },
      mouth: {
        center: this.getMouthCenter(),
        radius: this.getMouthRadius(),
        intensity: params.mouthSize,
        horizontalIntensity: params.mouthWidth,
      },
      // forehead: {
      //   center: {
      //     x: (this.getLandmarkCoordinates(10).x + this.getLandmarkCoordinates(152).x) / 2,
      //     y: this.getLandmarkCoordinates(10).y,
      //   },
      //   radius: this.imageWidth * 0.15,
      //   verticalIntensity: params.foreheadHeight,
      // },
      eyes: {
        center: {
          x: (this.getLandmarkCoordinates(133).x + this.getLandmarkCoordinates(362).x) / 2,
          y: (this.getLandmarkCoordinates(133).y + this.getLandmarkCoordinates(362).y) / 2,
        },
        radius: this.imageWidth * 0.15,
        horizontalIntensity: params.eyeDistance,
      },
    }
  }

  /**
   * Get coordinates for a specific landmark
   * @param index Index of the landmark
   */
  private getLandmarkCoordinates(index: number): { x: number; y: number } {
    if (!this.landmarks || !this.landmarks[index]) {
      throw new Error(`Landmark at index ${index} not found`)
    }

    return {
      x: this.landmarks[index].x * this.imageWidth,
      y: this.landmarks[index].y * this.imageHeight,
    }
  }

  // Helper to get mouth center (midpoint between mouth corners)
  private getMouthCenter(): { x: number; y: number } {
    const left = this.getLandmarkCoordinates(this.FACIAL_FEATURES.mouthWidth[0])
    const right = this.getLandmarkCoordinates(this.FACIAL_FEATURES.mouthWidth[1])
    return {
      x: (left.x + right.x) / 2,
      y: (left.y + right.y) / 2,
    }
  }
  // Helper to get mouth radius (distance between corners * 0.6)
  private getMouthRadius(): number {
    const left = this.getLandmarkCoordinates(this.FACIAL_FEATURES.mouthWidth[0])
    const right = this.getLandmarkCoordinates(this.FACIAL_FEATURES.mouthWidth[1])
    const dx = left.x - right.x
    const dy = left.y - right.y
    return Math.sqrt(dx * dx + dy * dy) * 0.6
  }

  /**
   * Apply warping to the image
   * @param sourceData Source image data
   * @param targetData Target image data
   * @param features Facial feature regions
   */
  private warpImage(sourceData: ImageData, targetData: ImageData, features: FacialFeatures): void {
    const sourcePixels = sourceData.data
    const targetPixels = targetData.data
    const width = this.imageWidth
    const height = this.imageHeight
    console.log("Warping image...", features)
    // Apply warping for each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Initialize source coordinates to current pixel
        let srcX = x
        let srcY = y
        let totalWarpFactorX = 0
        let totalWarpFactorY = 0
        let totalWeight = 0

        // Apply warping from each feature
        for (const [feature, props] of Object.entries(features)) {
          const dx = x - props.center.x
          const dy = y - props.center.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          // Only apply effect within the feature's radius of influence
          if (distance < props.radius * 2) {
            // Calculate weight based on distance (closer = stronger effect)
            const weight = Math.pow(1 - Math.min(1, distance / (props.radius * 2)), 2)

            // Different warping for different features
            let warpX = 0
            let warpY = 0

            if (feature === "nose") {
              // Nose size and height adjustments
              warpX = dx * (props.horizontalIntensity || 0) * weight
              warpY = dy * (props.verticalIntensity || 0) * weight
            } else if (feature === "leftCheek") {
              // Left cheek size adjustment (inward/outward)
              warpX = dx * (props.intensity || 0) * weight // Negative for left cheek
              warpY = 0
            } else if (feature === "rightCheek") {
              // Right cheek size adjustment (inward/outward)
              warpX = dx * (props.intensity || 0) * weight // Positive for right cheek
              warpY = 0
            } else if (feature === "chin") {
              // Chin width and height adjustments
              warpX = dx * (props.horizontalIntensity || 0) * weight
              warpY = dy * (props.verticalIntensity || 0) * weight

              // Extra vertical adjustment for chin height
              if (y > props.center.y) {
                warpY *= 1.5 // Stronger effect on the bottom part of chin
              }
            } else if (feature === "leftNostril" || feature === "rightNostril") {
              // Nostril width adjustment
              const direction = feature === "leftNostril" ? -1 : 1
              warpX = dx * (props.intensity || 0) * direction * weight
              warpY = 0
            } else if (feature === "mouth") {
              // Mouth size adjustment (radial scaling)
              // Positive intensity: enlarge, Negative: shrink
              const scale = 1 + (props.intensity || 0) * weight
              warpX = dx * (1 - 1 / scale)
              warpY = dy * (1 - 1 / scale)

              // Add horizontal stretching/compression for mouth width
              if (props.horizontalIntensity) {
                warpX += dx * props.horizontalIntensity * weight
              }
            } else if (feature === "forehead") {
              // Forehead height adjustment
              if (props.verticalIntensity) {
                warpY = dy * props.verticalIntensity * weight
              }
            } else if (feature === "eyes") {
              // Eye distance adjustment
              if (props.horizontalIntensity) {
                // Apply horizontal stretching/compression
                // Positive: move eyes apart, Negative: move eyes closer
                const eyeCenter = props.center.x
                const direction = x < eyeCenter ? -1 : 1
                warpX = Math.abs(dx) * props.horizontalIntensity * direction * weight
              }
            }

            totalWarpFactorX += warpX
            totalWarpFactorY += warpY
            totalWeight += weight
          }
        }

        // Apply combined warping if any feature affected this pixel
        if (totalWeight > 0) {
          srcX = x - totalWarpFactorX
          srcY = y - totalWarpFactorY
        }

        // Ensure source coordinates are within bounds
        srcX = Math.max(0, Math.min(width - 1, srcX))
        srcY = Math.max(0, Math.min(height - 1, srcY))

        // Bilinear interpolation for smoother results
        this.applyBilinearInterpolation(sourcePixels, targetPixels, x, y, srcX, srcY, width)
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
    width: number,
  ): void {
    const srcX1 = Math.floor(sourceX)
    const srcY1 = Math.floor(sourceY)
    const srcX2 = Math.min(srcX1 + 1, this.imageWidth - 1)
    const srcY2 = Math.min(srcY1 + 1, this.imageHeight - 1)

    const xWeight = sourceX - srcX1
    const yWeight = sourceY - srcY1

    const index = (targetY * width + targetX) * 4
    const index11 = (srcY1 * width + srcX1) * 4
    const index12 = (srcY1 * width + srcX2) * 4
    const index21 = (srcY2 * width + srcX1) * 4
    const index22 = (srcY2 * width + srcX2) * 4

    // Interpolate color channels (R, G, B, A)
    for (let i = 0; i < 4; i++) {
      const top = sourceData[index11 + i] * (1 - xWeight) + sourceData[index12 + i] * xWeight
      const bottom = sourceData[index21 + i] * (1 - xWeight) + sourceData[index22 + i] * xWeight
      targetData[index + i] = Math.round(top * (1 - yWeight) + bottom * yWeight)
    }
  }

  private getDistance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
  }

  private clamp(value: number, min = -100, max = 100): number {
    return Math.max(min, Math.min(max, value))
  }

  private generateFeedback(name: string, actual: number, ideal: number, label: string): WarpingFeedback {
    const deviation = (actual / ideal - 1) * -100
    const adjusted = this.clamp(deviation)
    let comment: string | null = null

    // Short feedback: just show percent change
    const percent = Math.round(adjusted)
    if (percent === 0) {
      comment = `${label}: 0%`
    } else if (percent > 0) {
      comment = `${label}: +${percent}%`
    } else {
      comment = `${label}: ${percent}%`
    }

    return {
      [name]: adjusted,
      [`${name}Comment`]: comment,
    }
  }

  public calculateWarpingParametersWithFeedback(): WarpingFeedback {
    const lm = this.landmarks

    const leftEyeCenter = lm[133]
    const rightEyeCenter = lm[362]
    const eyeDistance = this.getDistance(leftEyeCenter, rightEyeCenter)

    const mouthLeft = lm[61]
    const mouthRight = lm[291]
    const mouthWidth = this.getDistance(mouthLeft, mouthRight)

    const noseLeft = lm[94]
    const noseRight = lm[331]
    const noseWidth = this.getDistance(noseLeft, noseRight)

    const chin = lm[152]
    const upperLip = lm[13]
    const chinHeight = this.getDistance(upperLip, chin)

    const forehead = lm[10]
    const midNose = lm[1]
    const foreheadHeight = this.getDistance(forehead, midNose)

    const leftEyeInner = lm[33]
    const leftEyeOuter = lm[133]
    const singleEyeWidth = this.getDistance(leftEyeInner, leftEyeOuter)

    const faceHeight = this.getDistance(forehead, chin)

    // Ideal ratios based on classical facial proportion theories
    const idealRatios = {
      mouthToEye: 1.0,
      noseToMouth: 0.75,
      chinToFace: 0.25,
      foreheadToFace: 0.25,
      eyeGapToWidth: 1.0,
    }

    // Actual ratios
    const actualRatios = {
      mouthToEye: mouthWidth / eyeDistance,
      noseToMouth: noseWidth / mouthWidth,
      chinToFace: chinHeight / faceHeight,
      foreheadToFace: foreheadHeight / faceHeight,
      eyeGapToWidth: eyeDistance / singleEyeWidth,
    }
    console.log("Actual Ratios:", actualRatios)
    console.log("Ideal Ratios:", idealRatios)
    // Generate comprehensive feedback for each feature
    const feedback = {
      ...this.generateFeedback("mouthWidth", actualRatios.mouthToEye, idealRatios.mouthToEye, "Mouth width"),
      ...this.generateFeedback("noseWidth", actualRatios.noseToMouth, idealRatios.noseToMouth, "Nose width"),
      ...this.generateFeedback("chinHeight", actualRatios.chinToFace, idealRatios.chinToFace, "Chin height"),
      ...this.generateFeedback(
        "foreheadHeight",
        actualRatios.foreheadToFace,
        idealRatios.foreheadToFace,
        "Forehead height",
      ),
      ...this.generateFeedback("eyeDistance", actualRatios.eyeGapToWidth, idealRatios.eyeGapToWidth, "Eyes spacing"),

      // Add overall facial harmony assessment
      overallHarmony: this.calculateOverallHarmony(actualRatios, idealRatios),
    }

    return feedback
  }

  // Calculate overall facial harmony score
  private calculateOverallHarmony(actual: any, ideal: any): string {
    const deviations = [
      Math.abs((actual.mouthToEye / ideal.mouthToEye - 1) * 100),
      Math.abs((actual.noseToMouth / ideal.noseToMouth - 1) * 100),
      Math.abs((actual.chinToFace / ideal.chinToFace - 1) * 100),
      Math.abs((actual.foreheadToFace / ideal.foreheadToFace - 1) * 100),
      Math.abs((actual.eyeGapToWidth / ideal.eyeGapToWidth - 1) * 100),
    ]

    const avgDeviation = deviations.reduce((sum, val) => sum + val, 0) / deviations.length

    if (avgDeviation < 8) {
      return "Your facial proportions are very well-balanced and harmonious. Any adjustments would be minimal and based purely on personal preference."
    } else if (avgDeviation < 15) {
      return "Your facial proportions are generally balanced with minor deviations from classical ideals. Subtle adjustments could enhance your natural harmony."
    } else if (avgDeviation < 25) {
      return "Your facial proportions show moderate deviations from classical ideals. Targeted adjustments to specific features could enhance overall facial harmony."
    } else {
      return "Your facial proportions have noticeable deviations from classical ideals. Consider the suggested adjustments for each feature to create a more balanced appearance, though remember that unique features often contribute to distinctive beauty."
    }
  }
}
