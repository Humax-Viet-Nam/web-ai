/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/context/VisionWorker.ts

import {
    HandLandmarker,
    FaceLandmarker,
    PoseLandmarker,
    FilesetResolver,
    ImageSegmenter,
} from "@mediapipe/tasks-vision";

const models = new Map<string, any>();

const modelConfigs: { [key: string]: any } = {
    hand: {
        class: HandLandmarker,
        options: {
            baseOptions: {
                modelAssetPath: `/models/hand_landmarker.task`,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
        },
    },
    face: {
        class: FaceLandmarker,
        options: {
            baseOptions: {
                modelAssetPath: `/models/face_landmarker.task`,
                delegate: "GPU",
            },
            outputFaceBlendshapes: false,
            runningMode: "VIDEO",
            numFaces: 1,
        },
    },
    hair: {
        class: ImageSegmenter,
        options: {
            baseOptions: {
                modelAssetPath: "/models/hair_segmenter.tflite",
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            outputCategoryMask: true,
            outputConfidenceMasks: false,
        },
    },
    pose: {
        class: PoseLandmarker,
        options: {
            baseOptions: {
                modelAssetPath: `/models/pose_landmarker_lite.task`,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
        },
    },
};

let filesetResolver: any = null;
let isDetecting = false;
const frameQueue: any = [];
const MAX_QUEUE_SIZE = 5;
let lastIndexRaisedTime = 0;
const INDEX_RAISED_TIMEOUT = 1500; // 1.5 giây timeout để chuyển sang các mô hình khác

const isIndexRaised = (landmarks: any[]): boolean => {
    if (!landmarks || landmarks.length < 17) return false;

    const p5 = landmarks[5]; // gốc ngón trỏ
    const p8 = landmarks[8]; // đầu ngón trỏ
    const p12 = landmarks[12]; // đầu ngón giữa
    const p16 = landmarks[16]; // đầu ngón đeo nhẫn

    // 1. Kiểm tra góc giữa p5 → p8
    const dx = p8.x - p5.x;
    const dy = p8.y - p5.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // so với trục X

    const angleOk = Math.abs(angle + 90) < 45;

    // 2. Đảm bảo đầu ngón trỏ thấp hơn (cao hơn trên trục Y) so với các ngón khác
    const yOk = p8.y < p12.y - 0.02 && p8.y < p16.y - 0.02;

    // 3. (Tùy chọn) Đảm bảo trỏ không bị gập xuống
    const isNotFolded = p8.y < p5.y;

    return angleOk && yOk && isNotFolded;
};

// const isOkGesture = (landmarks: any[]): boolean => {
//     if (!landmarks || landmarks.length < 21) return false;

//     const thumbTip = landmarks[4];
//     const indexTip = landmarks[8];
//     const middleTip = landmarks[12];
//     const ringTip = landmarks[16];
//     const pinkyTip = landmarks[20];

//     const middlePIP = landmarks[10];
//     const ringPIP = landmarks[14];
//     const pinkyPIP = landmarks[18];

//     // Helper: tính khoảng cách 2 điểm
//     const distance = (a: any, b: any): number => {
//         return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
//     };

//     // Tính chiều dài tương đối bàn tay (index_mcp to wrist) để chuẩn hóa ngưỡng
//     const handScale = distance(landmarks[0], landmarks[5]);

//     // 1. Ngón cái và ngón trỏ chạm nhau
//     const thumbIndexDist = distance(thumbTip, indexTip);
//     const thumbIndexClose = thumbIndexDist < handScale * 0.7; // ngưỡng ~40% chiều dài tay

//     // 2. Ngón cái không chạm các ngón còn lại
//     const thumbNotTouchingOthers =
//         distance(thumbTip, middleTip) > handScale * 0.6 &&
//         distance(thumbTip, ringTip) > handScale * 0.6 &&
//         distance(thumbTip, pinkyTip) > handScale * 0.6;

//     // 3. Các ngón giữa, áp út, út duỗi thẳng (tip cao hơn PIP - theo trục Y)
//     const isMiddleStraight = middleTip.y < middlePIP.y;
//     const isRingStraight = ringTip.y < ringPIP.y;
//     const isPinkyStraight = pinkyTip.y < pinkyPIP.y;

//     return (
//         thumbIndexClose &&
//         thumbNotTouchingOthers &&
//         isMiddleStraight &&
//         isRingStraight &&
//         isPinkyStraight
//     );
// };

const isOkGesture = (landmarks: any[]) => {
    if (!landmarks || landmarks.length < 21) return false;

    // Get relevant landmark points
    const thumbTip = landmarks[4]; // Thumb tip
    const indexTip = landmarks[8]; // Index finger tip
    const middleTip = landmarks[12]; // Middle finger tip
    const ringTip = landmarks[16]; // Ring finger tip
    const pinkyTip = landmarks[20]; // Pinky tip

    // Get base points for each finger
    const wrist = landmarks[0]; // Wrist point
    const middleMcp = landmarks[9]; // Middle finger base
    const ringMcp = landmarks[13]; // Ring finger base
    const pinkyMcp = landmarks[17]; // Pinky base

    // Middle points for checking if fingers are extended
    const middlePip = landmarks[10]; // Middle finger middle joint
    const ringPip = landmarks[14]; // Ring finger middle joint
    const pinkyPip = landmarks[18]; // Pinky middle joint

    // 1. Check if thumb and index finger are touching
    const distance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Threshold for considering thumb and index are touching
    const touchThreshold = 0.05;
    const areTouching = distance < touchThreshold;

    // 2. Check if middle finger is extended
    const middleExtended =
        middleTip.y < middlePip.y &&
        calculateDistanceToWrist(middleTip, wrist) >
            calculateDistanceToWrist(middleMcp, wrist);

    // 3. Check if ring finger is extended
    const ringExtended =
        ringTip.y < ringPip.y &&
        calculateDistanceToWrist(ringTip, wrist) >
            calculateDistanceToWrist(ringMcp, wrist);

    // 4. Check if pinky is extended
    const pinkyExtended =
        pinkyTip.y < pinkyPip.y &&
        calculateDistanceToWrist(pinkyTip, wrist) >
            calculateDistanceToWrist(pinkyMcp, wrist);

    // All conditions must be true for OK gesture
    return areTouching && middleExtended && ringExtended && pinkyExtended;
};
const calculateDistanceToWrist = (point: any, wrist: any) => {
    return Math.sqrt(
        Math.pow(point.x - wrist.x, 2) + Math.pow(point.y - wrist.y, 2)
    );
};

const handleDetect = async () => {
    if (isDetecting || frameQueue.length === 0) return;

    const { imageBitmap, timestamp, modelTypes } = frameQueue.shift()!;
    // Clear các frame cũ để đảm bảo xử lý tức thì
    while (frameQueue.length > 0) {
        const dropped = frameQueue.shift();
        dropped?.imageBitmap?.close();
    }
    isDetecting = true;
    //console.log(`[VisionWorker] Start detect at ${timestamp}, modelTypes: ${modelTypes.join(", ")}`);

    try {
        const results: { [key: string]: any } = {};
        let indexRaised = false;

        // Ưu tiên phát hiện tay
        if (modelTypes.includes("hand") && models.has("hand")) {
            //console.log("[VisionWorker] Detecting hand...");
            const handResult = await models
                .get("hand")
                .detectForVideo(imageBitmap, timestamp);
            results.hand = handResult || { landmarks: [] };

            if (handResult?.landmarks?.length > 0) {
                //console.log(`[VisionWorker] Hand detected. Landmarks count: ${handResult.landmarks.length}`);
                indexRaised = isIndexRaised(handResult.landmarks[0]);
                results.hand.isIndexRaised = indexRaised;

                results.hand.isOkGesture = isOkGesture(handResult.landmarks[0]);

                if (indexRaised) {
                    lastIndexRaisedTime = timestamp;
                    //console.log("[VisionWorker] Index finger raised, prioritizing hand.");
                }
            } else {
                //console.log("[VisionWorker] No hand landmarks detected.");
                results.hand.isIndexRaised = false;
                results.hand.isOkGesture = false;
            }
        } else {
            results.hand = { landmarks: [], isIndexRaised: false };
        }

        // Kiểm tra timeout: chỉ xử lý các mô hình khác nếu không phát hiện index raised trong 1.5 giây
        const now = timestamp;
        if (indexRaised || now - lastIndexRaisedTime < INDEX_RAISED_TIMEOUT) {
            if (indexRaised) {
                //console.log("[VisionWorker] Index raised detected, skipping other models.");
            } else {
                //console.log("[VisionWorker] Index raised timeout not reached, skipping other models.");
            }
        } else {
            // Xử lý các mô hình khác nếu không phát hiện index raised hoặc timeout đã hết
            const otherModels = modelTypes.filter((m: string) => m !== "hand");
            for (const modelType of otherModels) {
                if (models.has(modelType)) {
                    //console.log(`[VisionWorker] Detecting ${modelType}...`);
                    if (modelType === "hair") {
                        const hairRaw = await models
                            .get(modelType)
                            .segmentForVideo(imageBitmap, timestamp);
                        if (hairRaw?.categoryMask) {
                            const mask = hairRaw.categoryMask;
                            const maskData = mask.getAsUint8Array();
                            results[modelType] = {
                                data: maskData,
                                width: mask.width,
                                height: mask.height,
                                timestamp,
                            };
                        }
                    } else {
                        results[modelType] = await models
                            .get(modelType)
                            .detectForVideo(imageBitmap, timestamp);
                    }
                }
            }
        }

        //console.log("[VisionWorker] Posting detection result to main thread.", results);
        self.postMessage({ type: "detectionResult", results });
    } catch (err) {
        console.error("[VisionWorker] Detection error:", err);
        self.postMessage({
            type: "detectionError",
            error: (err as Error).message,
        });
    } finally {
        imageBitmap.close();
        isDetecting = false;
        setTimeout(() => handleDetect(), 0);
    }
};

self.onmessage = async (e: MessageEvent) => {
    const { type, data } = e.data;
    //console.log(`[VisionWorker] Message received: ${type}`, data || "");

    if (type === "initialize") {
        const { modelType } = data;
        if (!modelConfigs[modelType]) {
            self.postMessage({
                type: "initialized",
                success: false,
                error: `Unknown model type: ${modelType}`,
            });
            return;
        }

        try {
            if (!filesetResolver) {
                //console.log("[VisionWorker] Loading FilesetResolver...");
                filesetResolver = await FilesetResolver.forVisionTasks("/wasm");
            }

            if (!models.has(modelType)) {
                const { class: ModelClass, options } = modelConfigs[modelType];
                models.set(
                    modelType,
                    await ModelClass.createFromOptions(filesetResolver, options)
                );
                //console.log(`[VisionWorker] Model ${modelType} initialized successfully.`);
            }

            self.postMessage({ type: "initialized", success: true, modelType });
        } catch (err) {
            self.postMessage({
                type: "initialized",
                success: false,
                modelType,
                error: (err as Error).message,
            });
            console.error(
                `[VisionWorker] Error initializing model ${modelType}:`,
                err
            );
        }
    }

    if (type === "detectHair") {
        if (!filesetResolver) {
            filesetResolver = await FilesetResolver.forVisionTasks("/wasm");
        }
        const results: { [key: string]: any } = {};
        const { imageBitmap, timestamp, modelTypes } = data;
        const { class: ModelClass, options } = modelConfigs[modelTypes];
        models.set(
            modelTypes,
            await ModelClass.createFromOptions(filesetResolver, options)
        );
        results[modelTypes] = await models
            .get(modelTypes)
            .detectForVideo(imageBitmap, timestamp);
        self.postMessage({ type: "detectionResult", results });
        return;
    }

    if (type === "detect") {
        const { imageBitmap, timestamp, modelTypes } = data;
        if (frameQueue.length >= MAX_QUEUE_SIZE) {
            console.warn(
                "[VisionWorker] Frame queue full, dropping oldest frame."
            );
            const dropped = frameQueue.shift();
            dropped?.imageBitmap?.close();
        }
        frameQueue.push({ imageBitmap, timestamp, modelTypes });
        //console.log(`[VisionWorker] Frame queued. Queue size: ${frameQueue.length}`);
        handleDetect();
    }

    if (type === "cleanup") {
        const { modelType } = data;
        if (modelType && models.has(modelType)) {
            //console.log(`[VisionWorker] Cleaning up model: ${modelType}`);
            models.get(modelType).close();
            models.delete(modelType);
            self.postMessage({ type: "cleaned", success: true, modelType });
        } else if (!modelType) {
            //console.log("[VisionWorker] Cleaning up all models...");
            models.forEach((model) => model.close());
            models.clear();
            self.postMessage({ type: "cleaned", success: true });
        }
    }
};
