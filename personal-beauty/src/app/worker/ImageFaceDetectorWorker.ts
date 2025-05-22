import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker;

// Initialize the face landmarker
const initializeFaceLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "IMAGE",
        numFaces: 1
    });
};

// Handle messages from main thread
self.onmessage = async (e: MessageEvent) => {
    const { type, imageData } = e.data;

    switch (type) {
        case 'init':
            await initializeFaceLandmarker();
            self.postMessage({ type: 'initialized' });
            break;

        case 'detect':
            if (!faceLandmarker) {
                self.postMessage({ type: 'error', message: 'Face landmarker not initialized' });
                return;
            }

            try {
                const results = faceLandmarker.detect(imageData);
                self.postMessage({
                    type: 'results',
                    data: {
                        faceLandmarks: results.faceLandmarks
                    }
                });
            } catch (error) {
                console.error('Error during face detection:', error);
                self.postMessage({ 
                    type: 'error', 
                    data: {
                        message: error instanceof Error ? error : 'Detection failed' 
                    }
                });
            }
            break;
    }
};

// Export empty object to make TypeScript treat this as a module
export {};