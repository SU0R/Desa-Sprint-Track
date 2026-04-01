export type CameraResult = {
  stream?: MediaStream;
  supported: boolean;
  error?: string;
};

export interface CameraService {
  requestStream: () => Promise<CameraResult>;
}

export function createBrowserCameraService(): CameraService {
  return {
    async requestStream() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return {
          supported: false,
          error: 'Camera APIs are not supported in this browser.'
        };
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment'
          },
          audio: false
        });

        return {
          supported: true,
          stream
        };
      } catch (error) {
        return {
          supported: true,
          error:
            error instanceof Error
              ? error.message
              : 'Camera access was blocked.'
        };
      }
    }
  };
}
