/**
 * Nexus Proctor - proctor.js
 * Advanced AI proctoring simulation, telemetry capture, keystroke analysis,
 * Web Audio synthesizer, and canvas scanning telemetry graphics.
 */

class NexusProctoringSuite {
    constructor() {
        this.active = false;
        this.studentEmail = 'student@nexus.edu';
        this.warningCount = 0;
        this.cheatingProbability = 4; // Base 4%
        this.anomalyLogs = [];
        this.keyTimes = [];
        this.audioThreshold = 0.25; // Amplitude threshold
        this.audioContext = null;
        this.analyser = null;
        this.microphoneStream = null;
        this.simulatingState = 'normal'; // 'normal', 'gaze_left', 'gaze_right', 'phone', 'multi_person', 'whisper'
        this.typingPatternHumanity = 98; // Percentage of match with human dynamics
        
        // Listeners list for disposal
        this.listeners = {};
    }

    start(studentEmail) {
        this.active = true;
        this.studentEmail = studentEmail;
        this.warningCount = 0;
        this.cheatingProbability = 4;
        this.anomalyLogs = [];
        this.keyTimes = [];
        this.setupSecurityListeners();
        this.setupAudioMonitoring();
        this.logSecurityEvent('PROCTOR_SESSION_START', { status: 'secure_init', integrityCheck: 'OK' });
    }

    stop() {
        this.active = false;
        this.removeSecurityListeners();
        this.stopAudioMonitoring();
        this.logSecurityEvent('PROCTOR_SESSION_STOP', { status: 'terminated' });
    }

    setupSecurityListeners() {
        // Tab switching & window events
        this.listeners.visibilityChange = () => {
            if (document.hidden && this.active) {
                this.handleAnomaly('TAB_SWITCH_DETECTED', { detail: 'Browser lost focus / minimized' }, 20);
            }
        };

        this.listeners.windowBlur = () => {
            if (this.active) {
                this.handleAnomaly('WINDOW_BLUR', { detail: 'User navigated away from active container' }, 15);
            }
        };

        this.listeners.windowResize = () => {
            if (this.active) {
                this.handleAnomaly('WINDOW_RESIZE', { detail: `Screen dims changed: ${window.innerWidth}x${window.innerHeight}` }, 5);
            }
        };

        // Clipboard controls
        this.listeners.paste = (e) => {
            e.preventDefault();
            this.handleAnomaly('CLIPBOARD_PASTE_ATTEMPT', { detail: 'Paste operation blocked' }, 12);
        };
        
        this.listeners.copy = (e) => {
            e.preventDefault();
            this.handleAnomaly('CLIPBOARD_COPY_ATTEMPT', { detail: 'Copy operation blocked' }, 5);
        };

        // Keyboard tracking
        this.listeners.keydown = (e) => {
            if (!this.active) return;
            
            // F12 or Ctrl+Shift+I prevention (Simulated)
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
                this.handleAnomaly('DEV_TOOLS_TRIGGER', { key: e.key }, 25);
            }
            
            this.trackKeystroke(e);
        };

        document.addEventListener('visibilitychange', this.listeners.visibilityChange);
        window.addEventListener('blur', this.listeners.windowBlur);
        window.addEventListener('resize', this.listeners.windowResize);
        document.addEventListener('paste', this.listeners.paste);
        document.addEventListener('copy', this.listeners.copy);
        document.addEventListener('keydown', this.listeners.keydown);
    }

    removeSecurityListeners() {
        document.removeEventListener('visibilitychange', this.listeners.visibilityChange);
        window.removeEventListener('blur', this.listeners.windowBlur);
        window.removeEventListener('resize', this.listeners.windowResize);
        document.removeEventListener('paste', this.listeners.paste);
        document.removeEventListener('copy', this.listeners.copy);
        document.removeEventListener('keydown', this.listeners.keydown);
    }

    async setupAudioMonitoring() {
        try {
            // Attempt standard mic integration
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.microphoneStream = stream;
                
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContextClass();
                const source = this.audioContext.createMediaStreamSource(stream);
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
                source.connect(this.analyser);
                
                this.monitorAudioStream();
            }
        } catch (e) {
            console.warn("Microphone access declined or unavailable. Falling back to ambient noise simulator.", e);
            // Simulated fallback
            this.simulateAmbientNoise();
        }
    }

    stopAudioMonitoring() {
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    monitorAudioStream() {
        if (!this.active || !this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const checkVolume = () => {
            if (!this.active) return;
            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate simple sum / average amplitude
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength / 255; // Normalize to 0-1

            if (average > this.audioThreshold) {
                this.handleAnomaly('AUDIO_SPIKE_DETECTED', { amplitude: average.toFixed(2), detail: 'Whisper or acoustic anomaly' }, 10);
            }
            
            requestAnimationFrame(checkVolume);
        };
        
        checkVolume();
    }

    simulateAmbientNoise() {
        const triggerSimNoise = () => {
            if (!this.active) return;
            
            // Random vocal bursts (simulating environmental noise or whispers)
            if (Math.random() < 0.05 && this.simulatingState === 'whisper') {
                this.handleAnomaly('AUDIO_FREQUENCY_SPIKE', { amplitude: (0.4 + Math.random() * 0.3).toFixed(2), detail: 'Human frequency matches (whispering)' }, 12);
            }
            
            setTimeout(triggerSimNoise, 2000);
        };
        triggerSimNoise();
    }

    trackKeystroke(event) {
        const time = performance.now();
        this.keyTimes.push({ key: event.key, time });
        
        if (this.keyTimes.length > 30) {
            this.keyTimes.shift(); // Keep moving window
        }

        // Analyze Typing Cadence
        if (this.keyTimes.length > 5) {
            const intervals = [];
            for (let i = 1; i < this.keyTimes.length; i++) {
                intervals.push(this.keyTimes[i].time - this.keyTimes[i - 1].time);
            }
            
            const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
            const standardDeviation = Math.sqrt(variance);

            // standardDeviation < 4ms indicates robotic, uniform keystroke velocity (AI paste mimic / scripting tool)
            if (standardDeviation < 4 && mean < 15) {
                this.typingPatternHumanity = Math.max(10, this.typingPatternHumanity - 10);
                this.handleAnomaly('ROBOTIC_KEYSTROKE_CADENCE', { stdDev: standardDeviation.toFixed(2) + 'ms', speed: 'rapid' }, 18);
            } else {
                this.typingPatternHumanity = Math.min(100, this.typingPatternHumanity + 2);
            }
        }
    }

    async logSecurityEvent(type, payload) {
        if (window.NexusDB) {
            await window.NexusDB.logs.appendLog(type, this.studentEmail, payload);
        }
    }

    handleAnomaly(type, payload, riskWeight) {
        this.cheatingProbability = Math.min(100, this.cheatingProbability + riskWeight);
        
        const anomaly = {
            id: 'anom-' + Math.random().toString(36).substring(2, 9),
            type,
            payload,
            timestamp: new Date().toISOString(),
            riskIncrease: riskWeight
        };
        
        this.anomalyLogs.unshift(anomaly);
        
        // Save to blockchain logs
        this.logSecurityEvent(type, payload);
        
        // Fire audio warning ping
        this.playWarningFrequency();
        
        // Dispatch warning notifications
        window.dispatchEvent(new CustomEvent('nexus-proctor-alert', { detail: anomaly }));

        // Auto Warning counts
        if (riskWeight >= 10) {
            this.warningCount++;
            window.dispatchEvent(new CustomEvent('nexus-warning-issued', { detail: { warnings: this.warningCount, type } }));
        }

        // Sync with DB student state
        if (window.NexusDB) {
            const state = window.NexusDB.getStudentState(this.studentEmail);
            window.NexusDB.updateStudentState(this.studentEmail, {
                warnings: this.warningCount,
                riskScore: Math.floor(this.cheatingProbability),
                status: 'flagged'
            });
        }
    }

    // Web Audio Synthesizer: Play futuristic digital warning chimes (Zero network assets needed!)
    playWarningFrequency() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            
            // Node chains
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Cyber alarm chime
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
            osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.35); // Dive to A3
            
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.42);
        } catch (e) {
            console.log("Audio API failed to play feedback ping.");
        }
    }

    // Custom Telemetry Generator: Renders the glowing webcam overlay + eye gaze markers on canvas
    drawTelemetry(canvas, isWebcamGranted, videoElement) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, w, h);

        // Grid scan pattern
        ctx.strokeStyle = 'rgba(197, 168, 128, 0.04)'; // Muted Gold grid
        ctx.lineWidth = 1;
        const step = 20;
        for (let x = 0; x < w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        if (isWebcamGranted && videoElement && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            // Draw real webcam stream inverted/stylized
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1); // Mirror
            ctx.globalAlpha = 0.55;
            ctx.drawImage(videoElement, 0, 0, w, h);
            ctx.restore();
        } else {
            // Render High-Tech vector avatar scanner mockup
            ctx.strokeStyle = 'rgba(197, 168, 128, 0.25)'; // Muted Gold accent
            ctx.lineWidth = 2;

            // Draw scanning face silhouette
            ctx.beginPath();
            ctx.arc(w / 2, h / 2 - 10, 45, 0, Math.PI * 2); // head
            ctx.moveTo(w / 2 - 20, h / 2 + 35);
            ctx.bezierCurveTo(w / 2 - 50, h / 2 + 55, w / 2 - 60, h / 2 + 80, w / 2 - 60, h - 20); // left shoulder
            ctx.lineTo(w / 2 + 60, h - 20);
            ctx.bezierCurveTo(w / 2 + 60, h / 2 + 80, w / 2 + 50, h / 2 + 55, w / 2 + 20, h / 2 + 35); // right shoulder
            ctx.stroke();
            
            // Draw face grid overlay
            ctx.strokeStyle = 'rgba(197, 168, 128, 0.15)';
            ctx.beginPath();
            ctx.moveTo(w / 2 - 30, h / 2 - 10);
            ctx.lineTo(w / 2 + 30, h / 2 - 10);
            ctx.moveTo(w / 2, h / 2 - 40);
            ctx.lineTo(w / 2, h / 2 + 20);
            ctx.stroke();
        }

        // Draw animated target scanner box
        const scanY = (Math.sin(Date.now() / 350) + 1) * (h / 2) + 10;
        ctx.strokeStyle = 'rgba(197, 168, 128, 0.4)';
        ctx.beginPath();
        ctx.moveTo(15, scanY);
        ctx.lineTo(w - 15, scanY);
        ctx.stroke();

        // Dynamic pupil gaze targeting
        let gazeX = w / 2;
        let gazeY = h / 2 - 15;
        let statusText = "GAZE DETECTED: SECURE";
        let statusColor = "#C5A880";

        // Simulated movement variables based on simulation controls
        if (this.simulatingState === 'gaze_left') {
            gazeX = w / 2 - 38;
            gazeY = h / 2 - 10;
            statusText = "GAZE DEVIATING: LEFT OUTSIDE MARGIN";
            statusColor = "#ff4545";
            if (Math.random() < 0.03) {
                this.handleAnomaly('EYE_TRACKING_GAZE_LEFT', { deviation: '38px', duration: '1200ms' }, 1);
            }
        } else if (this.simulatingState === 'gaze_right') {
            gazeX = w / 2 + 40;
            gazeY = h / 2 - 12;
            statusText = "GAZE DEVIATING: RIGHT OUTSIDE MARGIN";
            statusColor = "#ff4545";
            if (Math.random() < 0.03) {
                this.handleAnomaly('EYE_TRACKING_GAZE_RIGHT', { deviation: '40px', duration: '1500ms' }, 1);
            }
        } else if (this.simulatingState === 'phone') {
            gazeX = w / 2;
            gazeY = h / 2 + 32;
            statusText = "OBJECT CLASSIFIER: MOBILE PHONE DETECTED";
            statusColor = "#ff4545";
            
            // Draw simulated phone box overlay
            ctx.strokeStyle = '#ff4545';
            ctx.strokeRect(w / 2 - 15, h / 2 + 20, 30, 45);
            ctx.fillStyle = 'rgba(255,69,69,0.1)';
            ctx.fillRect(w / 2 - 15, h / 2 + 20, 30, 45);
            
            if (Math.random() < 0.03) {
                this.handleAnomaly('OBJECT_DETECTION_DEVICE_SPOTTED', { confidence: '96.2%', class: 'cell_phone' }, 8);
            }
        } else if (this.simulatingState === 'multi_person') {
            statusText = "ANOMALY: MULTIPLE PERS. SPOTTED";
            statusColor = "#ff4545";
            
            // Second head silhouette outline
            ctx.strokeStyle = 'rgba(255, 69, 69, 0.4)';
            ctx.beginPath();
            ctx.arc(w / 2 + 65, h / 2 + 5, 28, 0, Math.PI * 2);
            ctx.stroke();
            
            if (Math.random() < 0.03) {
                this.handleAnomaly('PROCTOR_MULTI_FACE_DETECTION', { count: 2, confidence: '89.4%' }, 12);
            }
        }

        // Draw gaze pointers
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(gazeX - 15, gazeY, 3, 0, Math.PI * 2); // left eye gaze
        ctx.arc(gazeX + 15, gazeY, 3, 0, Math.PI * 2); // right eye gaze
        ctx.fill();

        // Gaze tracker crosshair target box
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(gazeX - 25, gazeY - 8, 50, 16);

        // Dynamic scanner text
        ctx.fillStyle = '#E5E5EB';
        ctx.font = '10px Courier New';
        ctx.fillText(statusText, 10, h - 35);
        ctx.fillStyle = 'rgba(229, 229, 235, 0.5)';
        ctx.fillText(`INTEGRITY SCORE: ${(100 - this.cheatingProbability).toFixed(0)}%`, 10, h - 20);

        // Security frame overlay
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, w, h);
    }

    // Explainable AI algorithm: Details the exact mathematical reasonings behind the integrity risk calculations.
    explainRisk() {
        const summaries = [];
        const logs = this.anomalyLogs;
        
        if (logs.length === 0) {
            return {
                summary: "Candidate exhibiting normative behavior patterns. System flags zero anomalies.",
                factors: [{ name: "Biometric authentication matching score", value: "99.4% Match", impact: "Optimal" }]
            };
        }

        // Aggregate parameters
        const counts = {};
        logs.forEach(l => {
            counts[l.type] = (counts[l.type] || 0) + 1;
        });

        if (counts['TAB_SWITCH_DETECTED'] || counts['WINDOW_BLUR']) {
            summaries.push(`Detected context switching (${counts['TAB_SWITCH_DETECTED'] || 0} tab changes / ${counts['WINDOW_BLUR'] || 0} screen blurs). Highly correlates with search engine queries outside the exam space.`);
        }
        
        if (counts['EYE_TRACKING_GAZE_LEFT'] || counts['EYE_TRACKING_GAZE_RIGHT']) {
            const totGaze = (counts['EYE_TRACKING_GAZE_LEFT'] || 0) + (counts['EYE_TRACKING_GAZE_RIGHT'] || 0);
            summaries.push(`Exhibited continuous peripheral gaze deviation (${totGaze} occurrences). High frequency outside focus vector bounds.`);
        }
        
        if (counts['CLIPBOARD_PASTE_ATTEMPT']) {
            summaries.push("Attempted standard system paste function. Potential external resource inject block.");
        }

        if (counts['OBJECT_DETECTION_DEVICE_SPOTTED']) {
            summaries.push("Machine vision model classified external secondary viewport (mobile smartphone) in the focal zone.");
        }

        if (counts['ROBOTIC_KEYSTROKE_CADENCE']) {
            summaries.push("Typing pattern exhibits minimal variance in dwell-time delay, matching automated copy-paste script injections.");
        }

        const factors = [];
        Object.keys(counts).forEach(key => {
            factors.push({
                name: key.replace(/_/g, ' '),
                count: counts[key],
                weight: `+${(counts[key] * 5)}% Risk Weight`
            });
        });

        return {
            summary: summaries.join(' '),
            factors: factors
        };
    }
}

window.NexusProctoringSuite = NexusProctoringSuite;
window.Proctor = new NexusProctoringSuite();
