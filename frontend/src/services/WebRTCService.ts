/**
 * WebRTC Service for Mesh Video & RTCDataChannel
 * Handles SDP Offer/Answer signaling over STOMP, Trickle ICE, and DataChannels.
 */
import { Client } from '@stomp/stompjs';

export interface WebRTCMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  senderId: string;
  targetId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private stompClient: Client | null = null;
  private localId: string = '';
  
  // Callback when a remote track is received
  public onTrackReceived?: (peerId: string, stream: MediaStream) => void;
  // Callback when a data channel receives a chunk
  public onDataReceived?: (peerId: string, data: ArrayBuffer) => void;

  public initialize(stompClient: Client, localId: string) {
    this.stompClient = stompClient;
    this.localId = localId;

    // Subscribe to WebRTC signaling topic
    this.stompClient.subscribe(`/topic/webrtc.${this.localId}`, (message) => {
      const payload: WebRTCMessage = JSON.parse(message.body);
      this.handleSignalingMessage(payload);
    });
  }

  public createPeer(peerId: string, polite: boolean, localStream?: MediaStream): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Perfect Negotiation pattern flags
    let makingOffer = false;
    let ignoreOffer = false;

    // 1. Add Local Tracks (if any)
    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    // 2. Setup Data Channel for polite peer
    if (!polite) {
      const dc = pc.createDataChannel('fileTransfer', { negotiated: false });
      this.setupDataChannel(peerId, dc);
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel);
      };
    }

    // 3. Handle incoming remote tracks
    pc.ontrack = (event) => {
      if (this.onTrackReceived && event.streams[0]) {
        this.onTrackReceived(peerId, event.streams[0]);
      }
    };

    // 4. Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.stompClient) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          senderId: this.localId,
          targetId: peerId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    // 5. Perfect Negotiation - Negotiation Needed
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        await pc.setLocalDescription();
        this.sendSignalingMessage({
          type: 'offer',
          senderId: this.localId,
          targetId: peerId,
          sdp: pc.localDescription!
        });
      } catch (err) {
        console.error('Error during negotiation:', err);
      } finally {
        makingOffer = false;
      }
    };

    // Store PC reference via an internal custom object if needed, but for now just map it
    (pc as any).makingOffer = makingOffer;
    (pc as any).ignoreOffer = ignoreOffer;
    (pc as any).polite = polite;

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private async handleSignalingMessage(message: WebRTCMessage) {
    const pc = this.peerConnections.get(message.senderId) || this.createPeer(message.senderId, true); // true = polite peer for incoming connections
    
    let makingOffer = (pc as any).makingOffer;
    let polite = (pc as any).polite;
    let ignoreOffer = (pc as any).ignoreOffer;

    try {
      if (message.sdp) {
        const offerCollision = (message.sdp.type === 'offer') &&
          (makingOffer || pc.signalingState !== 'stable');

        ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) {
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        
        if (message.sdp.type === 'offer') {
          await pc.setLocalDescription();
          this.sendSignalingMessage({
            type: 'answer',
            senderId: this.localId,
            targetId: message.senderId,
            sdp: pc.localDescription!
          });
        }
      } else if (message.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (err) {
          if (!ignoreOffer) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error handling signaling message:', err);
    }
  }

  private sendSignalingMessage(message: WebRTCMessage) {
    if (this.stompClient?.connected) {
      this.stompClient.publish({
        destination: `/app/webrtc.signal`,
        body: JSON.stringify(message)
      });
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dc.onmessage = (event) => {
      if (this.onDataReceived) {
        this.onDataReceived(peerId, event.data as ArrayBuffer);
      }
    };
    dc.onclose = () => this.dataChannels.delete(peerId);
    this.dataChannels.set(peerId, dc);
  }

  /**
   * Broadcast binary data chunk across all active DataChannels
   */
  public broadcastDataChunk(chunk: ArrayBuffer) {
    this.dataChannels.forEach((dc, peerId) => {
      if (dc.readyState === 'open') {
        // Implement active backpressure polling
        if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
          console.warn(`DataChannel backpressure high for ${peerId}. Need to throttle.`);
          // A robust implementation would queue this chunk, wait for onbufferedamountlow, and resume.
        }
        dc.send(chunk);
      }
    });
  }

  public disconnectAll() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.dataChannels.clear();
  }
}

export const webRTCService = new WebRTCService();
