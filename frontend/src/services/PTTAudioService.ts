/**
 * Push-To-Talk (PTT) Audio Service
 * Captures microphone bursts using MediaRecorder (audio/webm;codecs=opus)
 * Encodes audio blob into base64 and publishes to STOMP broker.
 */

import { Client } from '@stomp/stompjs';
import { identityService } from './IdentityService';

export interface VoicePayload {
  type: 'VOICE';
  sender: string;
  tag: string;
  audioData: string; // base64
  durationSec: number;
  timestamp: number;
}

export class PTTAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private stompClient: Client | null = null;
  private localId: string = '';
  private isRecording: boolean = false;
  private startTime: number = 0;

  public initialize(stompClient: Client, localId: string) {
    this.stompClient = stompClient;
    this.localId = localId;
  }

  public async startRecording(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      this.recordedChunks = [];
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Check supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      this.mediaRecorder = new MediaRecorder(this.audioStream, mimeType ? { mimeType } : undefined);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.startTime = Date.now();
      return true;
    } catch (err) {
      console.error('Microphone access blocked or failed:', err);
      this.isRecording = false;
      return false;
    }
  }

  public stopRecording(): Promise<VoicePayload | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      this.isRecording = false;
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const durationSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
      this.isRecording = false;

      this.mediaRecorder!.onstop = async () => {
        const audioBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        
        // Clean up audio tracks
        if (this.audioStream) {
          this.audioStream.getTracks().forEach(track => track.stop());
          this.audioStream = null;
        }

        const base64 = await this.blobToBase64(audioBlob);
        const idState = identityService.getSafeState();
        const payload: VoicePayload = {
          type: 'VOICE',
          sender: idState ? idState.fullName : `Operator_${this.localId.substring(0, 4)}`,
          tag: idState ? idState.deviceTag : '#0000',
          audioData: base64,
          durationSec,
          timestamp: Date.now()
        };

        if (this.stompClient?.connected) {
          this.stompClient.publish({
            destination: '/app/chat.sendVoice',
            body: JSON.stringify(payload)
          });
        }

        resolve(payload);
      };

      try {
        if (this.mediaRecorder!.state !== 'inactive') {
          this.mediaRecorder!.stop();
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip data prefix if needed
        const base64Data = base64String.split(',')[1] || base64String;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const pttAudioService = new PTTAudioService();
