/**
 * H.264 & MPEG-PS Stream Demuxer for Hikvision / Annke IP Cameras
 * Extracts raw H.264 NAL units from MPEG-PS, RTP, HKMI headers, and elementary streams.
 * Correctly packages complete Access Units (Keyframe = SPS + PPS + IDR; Delta = Slice) for WebCodecs.
 */

if (typeof window !== "undefined" && window.H264Demuxer) {
  // Guarded against re-declaration
} else {
  class H264Demuxer {
    constructor(onFrame) {
      this.onFrame = onFrame; // Callback: (frameData, isKeyFrame, timestamp, meta)
      this.sps = null;
      this.pps = null;
      this.sei = null;
      this.buffer = new Uint8Array(0);
      this.fuBuffer = null;
      this.fuNalType = 0;
    }

    appendData(chunk) {
      if (!chunk || chunk.length === 0) return;

      const combined = new Uint8Array(this.buffer.length + chunk.length);
      combined.set(this.buffer, 0);
      combined.set(chunk, this.buffer.length);
      this.buffer = combined;

      this.processBuffer();
    }

    processBuffer() {
      // 1. Detect and skip Hikvision HKMI header (40 bytes starting with 'IMKH' 0x49 0x4D 0x4B 0x48)
      if (
        this.buffer.length >= 40 &&
        this.buffer[0] === 0x49 &&
        this.buffer[1] === 0x4D &&
        this.buffer[2] === 0x4B &&
        this.buffer[3] === 0x48
      ) {
        this.buffer = this.buffer.subarray(40);
      }

      let offset = 0;
      const len = this.buffer.length;

      while (offset < len - 4) {
        // Look for 0x00 0x00 0x01 start code
        if (
          this.buffer[offset] === 0x00 &&
          this.buffer[offset + 1] === 0x00 &&
          this.buffer[offset + 2] === 0x01
        ) {
          const streamId = this.buffer[offset + 3];

          // MPEG-PS Pack Header (0xBA)
          if (streamId === 0xBA) {
            offset += 4;
            if (offset + 10 <= len) {
              const stuffingLen = this.buffer[offset + 9] & 0x07;
              offset += 10 + stuffingLen;
            }
            continue;
          }

          // MPEG-PS System Header (0xBB)
          if (streamId === 0xBB) {
            offset += 4;
            if (offset + 2 <= len) {
              const headerLen = (this.buffer[offset] << 8) | this.buffer[offset + 1];
              offset += 2 + headerLen;
            }
            continue;
          }

          // MPEG-PS Program Stream Map (0xBC) or Private Stream 2 (0xBF)
          if (streamId === 0xBC || streamId === 0xBF) {
            offset += 4;
            if (offset + 2 <= len) {
              const psmLen = (this.buffer[offset] << 8) | this.buffer[offset + 1];
              offset += 2 + psmLen;
            }
            continue;
          }

          // MPEG-PS Video PES Packet (0xE0 - 0xEF)
          if (streamId >= 0xE0 && streamId <= 0xEF) {
            offset += 4;
            if (offset + 2 > len) {
              offset -= 4;
              break;
            }
            const pesPacketLen = (this.buffer[offset] << 8) | this.buffer[offset + 1];
            offset += 2;

            if (pesPacketLen > 0 && offset + pesPacketLen > len) {
              // Wait for full PES packet
              offset -= 6;
              break;
            }

            if (offset + 3 <= len) {
              const headerFlags = this.buffer[offset + 1];
              const pesHeaderDataLen = this.buffer[offset + 2];
              let pts = 0;

              if ((headerFlags & 0x80) && pesHeaderDataLen >= 5 && offset + 8 <= len) {
                const b0 = this.buffer[offset + 3];
                const b1 = this.buffer[offset + 4];
                const b2 = this.buffer[offset + 5];
                const b3 = this.buffer[offset + 6];
                const b4 = this.buffer[offset + 7];
                pts =
                  ((b0 & 0x0E) << 29) |
                  (b1 << 22) |
                  ((b2 & 0xFE) << 14) |
                  (b3 << 7) |
                  ((b4 & 0xFE) >> 1);
              }

              offset += 3 + pesHeaderDataLen;
              let payloadEnd;
              if (pesPacketLen > 0) {
                payloadEnd = offset - 3 - pesHeaderDataLen + pesPacketLen;
              } else {
                // If pesPacketLen is 0, find next start code
                payloadEnd = len;
                for (let p = offset; p < len - 3; p++) {
                  if (
                    this.buffer[p] === 0 &&
                    this.buffer[p + 1] === 0 &&
                    this.buffer[p + 2] === 1
                  ) {
                    payloadEnd = p;
                    break;
                  }
                }
              }

              const payload = this.buffer.subarray(offset, Math.min(payloadEnd, len));
              this.parseNalUnits(payload, pts);
              offset = payloadEnd;
            }
            continue;
          }

          // MPEG-PS Audio PES Packet (0xC0 - 0xDF)
          if (streamId >= 0xC0 && streamId <= 0xDF) {
            offset += 4;
            if (offset + 2 <= len) {
              const audioLen = (this.buffer[offset] << 8) | this.buffer[offset + 1];
              offset += 2 + (audioLen > 0 ? audioLen : 0);
            }
            continue;
          }

          // Direct Annex-B H.264 stream
          const nalPayload = this.buffer.subarray(offset);
          this.parseNalUnits(nalPayload, 0);
          offset = len;
          break;
        }

        // Interleaved RTP over RTSP ($ + channel + 2-byte length)
        if (this.buffer[offset] === 0x24 && offset + 4 <= len) {
          const channel = this.buffer[offset + 1];
          const rtpLen = (this.buffer[offset + 2] << 8) | this.buffer[offset + 3];
          if (offset + 4 + rtpLen <= len) {
            const rtpPayload = this.buffer.subarray(offset + 4, offset + 4 + rtpLen);
            if (channel === 0) {
              this.parseRtpPacket(rtpPayload);
            }
            offset += 4 + rtpLen;
            continue;
          } else {
            break;
          }
        }

        offset++;
      }

      if (offset > 0) {
        this.buffer = this.buffer.subarray(offset);
      }
    }

    parseNalUnits(data, pts) {
      let start = -1;
      let i = 0;
      const len = data.length;

      while (i < len - 3) {
        if (
          data[i] === 0 &&
          data[i + 1] === 0 &&
          (data[i + 2] === 1 || (data[i + 2] === 0 && data[i + 3] === 1))
        ) {
          const prefixLen = data[i + 2] === 1 ? 3 : 4;
          if (start !== -1) {
            this.handleNal(data.subarray(start, i), pts);
          }
          start = i + prefixLen;
          i += prefixLen;
        } else {
          i++;
        }
      }

      if (start !== -1 && start < len) {
        this.handleNal(data.subarray(start), pts);
      }
    }

    parseRtpPacket(rtp) {
      if (rtp.length < 12) return;
      const hasExtensions = (rtp[0] & 0x10) !== 0;
      const csrcCount = rtp[0] & 0x0F;
      let offset = 12 + csrcCount * 4;

      if (hasExtensions && offset + 4 <= rtp.length) {
        const extLen = (rtp[offset + 2] << 8) | rtp[offset + 3];
        offset += 4 + extLen * 4;
      }

      if (offset >= rtp.length) return;

      const payload = rtp.subarray(offset);
      const nalHeader = payload[0];
      const nalType = nalHeader & 0x1F;

      if (nalType >= 1 && nalType <= 23) {
        this.handleNal(payload, 0);
      } else if (nalType === 24) {
        // STAP-A aggregation
        let pOffset = 1;
        while (pOffset + 2 < payload.length) {
          const nSize = (payload[pOffset] << 8) | payload[pOffset + 1];
          pOffset += 2;
          if (pOffset + nSize <= payload.length) {
            this.handleNal(payload.subarray(pOffset, pOffset + nSize), 0);
            pOffset += nSize;
          } else {
            break;
          }
        }
      } else if (nalType === 28) {
        // FU-A fragmentation
        if (payload.length < 2) return;
        const fuIndicator = payload[0];
        const fuHeader = payload[1];
        const isStart = (fuHeader & 0x80) !== 0;
        const isEnd = (fuHeader & 0x40) !== 0;
        const actualNalType = fuHeader & 0x1F;
        const reconstructedHeader = (fuIndicator & 0xE0) | actualNalType;

        if (isStart) {
          this.fuBuffer = [new Uint8Array([reconstructedHeader]), payload.subarray(2)];
        } else if (this.fuBuffer) {
          this.fuBuffer.push(payload.subarray(2));
          if (isEnd) {
            let totalLen = 0;
            for (const b of this.fuBuffer) totalLen += b.length;
            const completeNal = new Uint8Array(totalLen);
            let writePos = 0;
            for (const b of this.fuBuffer) {
              completeNal.set(b, writePos);
              writePos += b.length;
            }
            this.fuBuffer = null;
            this.handleNal(completeNal, 0);
          }
        }
      }
    }

    handleNal(nal, pts) {
      if (!nal || nal.length === 0) return;
      const nalType = nal[0] & 0x1F;

      // 1. Parameter Sets & Metadata
      if (nalType === 7) {
        this.sps = nal;
        return;
      }
      if (nalType === 8) {
        this.pps = nal;
        return;
      }
      if (nalType === 6) {
        this.sei = nal;
        return;
      }
      if (nalType === 9) {
        // Access Unit Delimiter - skip
        return;
      }

      // 2. IDR Keyframe Slice (nalType === 5)
      if (nalType === 5) {
        if (!this.sps || !this.pps) return; // Wait until SPS & PPS are known

        const spsLen = this.sps.length;
        const ppsLen = this.pps.length;
        const nalLen = nal.length;
        const accessUnit = new Uint8Array(4 + spsLen + 4 + ppsLen + 4 + nalLen);

        accessUnit.set([0, 0, 0, 1], 0);
        accessUnit.set(this.sps, 4);
        accessUnit.set([0, 0, 0, 1], 4 + spsLen);
        accessUnit.set(this.pps, 4 + spsLen + 4);
        accessUnit.set([0, 0, 0, 1], 4 + spsLen + 4 + ppsLen);
        accessUnit.set(nal, 4 + spsLen + 4 + ppsLen + 4);

        if (this.onFrame) {
          this.onFrame(accessUnit, true, pts, { sps: this.sps, pps: this.pps });
        }
        return;
      }

      // 3. Non-IDR Slice (nalType === 1)
      if (nalType === 1) {
        const accessUnit = new Uint8Array(4 + nal.length);
        accessUnit[0] = 0;
        accessUnit[1] = 0;
        accessUnit[2] = 0;
        accessUnit[3] = 1;
        accessUnit.set(nal, 4);

        if (this.onFrame) {
          this.onFrame(accessUnit, false, pts, { sps: this.sps, pps: this.pps });
        }
      }
    }
  }

  if (typeof window !== "undefined") {
    window.H264Demuxer = H264Demuxer;
  }
}
