// Utility to decode base64 string
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Utility to concatenate multiple raw PCM audio segments with silence in between
export function concatenateRawAudio(segments: Uint8Array[], silenceDurationSec: number = 2, sampleRate: number = 24000): Uint8Array {
  // 16-bit audio = 2 bytes per sample
  const silenceLength = silenceDurationSec * sampleRate * 2;
  
  // Calculate total length: sum of all segments + silence between them
  const totalLength = segments.reduce((acc, seg) => acc + seg.length, 0) + 
                      (Math.max(0, segments.length - 1) * silenceLength);
  
  const result = new Uint8Array(totalLength);
  let offset = 0;

  segments.forEach((seg, i) => {
    result.set(seg, offset);
    offset += seg.length;
    
    // Add silence if not the last segment
    if (i < segments.length - 1) {
      // The array is initialized with zeros, so we just skip the offset index
      // Zero in PCM is silence
      offset += silenceLength;
    }
  });
  
  return result;
}

// Utility to decode raw PCM audio data from Gemini
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Utility to convert Blob to Base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}