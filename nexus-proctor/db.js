/**
 * Nexus Proctor - db.js
 * Simulated Encrypted Local Storage, Cryptographic Log Chain (Blockchain-style),
 * and Offline Sync State Manager.
 */

// Utility for native browser SHA-256 hash calculation
async function computeHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple XOR + Base64 simulated cipher representing AES-256
const CipherEngine = {
    encrypt(text, secretKey = 'NEXUS_AES_KEY_256') {
        const jsonText = typeof text === 'object' ? JSON.stringify(text) : String(text);
        let result = '';
        for (let i = 0; i < jsonText.length; i++) {
            const charCode = jsonText.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(unescape(encodeURIComponent(result)));
    },
    decrypt(cipherText, secretKey = 'NEXUS_AES_KEY_256') {
        try {
            const decoded = decodeURIComponent(escape(atob(cipherText)));
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
                result += String.fromCharCode(charCode);
            }
            try {
                return JSON.parse(result);
            } catch (e) {
                return result;
            }
        } catch (err) {
            console.error("Decryption failed. Buffer corrupt or incorrect key.", err);
            return null;
        }
    }
};

class SecurityLogChain {
    constructor() {
        this.storageKey = 'NEXUS_TAMPERPROOF_LOGS';
        if (!localStorage.getItem(this.storageKey)) {
            localStorage.setItem(this.storageKey, JSON.stringify([]));
        }
    }

    getLogs() {
        const encrypted = localStorage.getItem(this.storageKey);
        if (!encrypted) return [];
        try {
            return JSON.parse(encrypted);
        } catch (e) {
            return [];
        }
    }

    async appendLog(eventType, userId, payload) {
        const logs = this.getLogs();
        const prevLog = logs.length > 0 ? logs[logs.length - 1] : null;
        const prevHash = prevLog ? prevLog.hash : '0000000000000000000000000000000000000000000000000000000000000000';
        
        const timestamp = new Date().toISOString();
        const dataToHash = `${timestamp}|${eventType}|${userId}|${JSON.stringify(payload)}|${prevHash}`;
        const currentHash = await computeHash(dataToHash);

        const newLog = {
            index: logs.length,
            timestamp,
            eventType,
            userId,
            payload: CipherEngine.encrypt(payload), // Encrypted payload
            prevHash,
            hash: currentHash
        };

        logs.push(newLog);
        localStorage.setItem(this.storageKey, JSON.stringify(logs));
        
        // Also dispatch custom event for live dashboards
        window.dispatchEvent(new CustomEvent('nexus-new-log', { detail: { ...newLog, decryptedPayload: payload } }));
        return newLog;
    }

    // Verify blockchain-style hash integrity chain
    async verifyChainIntegrity() {
        const logs = this.getLogs();
        const verificationResults = [];
        let runningHash = '0000000000000000000000000000000000000000000000000000000000000000';

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const decryptedPayload = CipherEngine.decrypt(log.payload);
            const dataToHash = `${log.timestamp}|${log.eventType}|${log.userId}|${JSON.stringify(decryptedPayload)}|${log.prevHash}`;
            const expectedHash = await computeHash(dataToHash);

            const isPrevHashValid = log.prevHash === runningHash;
            const isCurrentHashValid = log.hash === expectedHash;
            const isValid = isPrevHashValid && isCurrentHashValid;

            verificationResults.push({
                index: log.index,
                timestamp: log.timestamp,
                eventType: log.eventType,
                isValid,
                details: {
                    prevHashValid: isPrevHashValid,
                    hashMatch: isCurrentHashValid
                }
            });

            runningHash = log.hash;
        }

        const overallValid = verificationResults.every(r => r.isValid);
        return { overallValid, chain: verificationResults };
    }

    // Simulates an attacker modifying local storage data
    async injectMaliciousMod(index, newPayloadText) {
        const logs = this.getLogs();
        if (logs[index]) {
            // Modify content without recomputing subsequent hashes
            logs[index].payload = CipherEngine.encrypt({ modified: true, alert: newPayloadText });
            localStorage.setItem(this.storageKey, JSON.stringify(logs));
            return true;
        }
        return false;
    }

    clearLogs() {
        localStorage.setItem(this.storageKey, JSON.stringify([]));
    }
}

// Global state controller simulating DB
const NexusDB = {
    logs: new SecurityLogChain(),
    cipher: CipherEngine,

    initialize() {
        if (!localStorage.getItem('NEXUS_EXAMS')) {
            const defaultExams = [
                {
                    id: 'exam-101',
                    title: 'Advanced AI Systems & Cognitive Cybersecurity',
                    course: 'CYBER-402',
                    duration: 30, // minutes
                    scheduledStart: new Date(Date.now() + 10 * 60000).toISOString(), // 10 mins from now
                    questions: [
                        {
                            id: 'q1',
                            type: 'objective',
                            text: 'Which architectural component is primarily responsible for preventing Model Inversion attacks on federated proctoring networks?',
                            options: [
                                'Homomorphic Encryption Layers',
                                'Differential Privacy Perturbation Gaskets',
                                'Secure Enclave Execution (SGX)',
                                'Zero-Knowledge Proof Verifiers'
                            ],
                            answer: 1, // index of option
                            points: 5
                        },
                        {
                            id: 'q2',
                            type: 'objective',
                            text: 'What constitutes the key mathematical signature in keystroke dynamics profiling?',
                            options: [
                                'Absolute keyboard pressure amplitude',
                                'Flight time (interval between key releases and next key press) and Dwell time',
                                'Browser event listener latency variables',
                                'OS level input buffer interruptions'
                            ],
                            answer: 1,
                            points: 5
                        },
                        {
                            id: 'q3',
                            type: 'subjective',
                            text: 'Analyze the architectural vulnerabilities associated with deploying standard CNN models for face verification in environments susceptible to lighting variance. Describe an alternative mitigation framework utilizing modern vision transformers (ViTs) and ambient illumination normalizers.',
                            points: 10
                        },
                        {
                            id: 'q4',
                            type: 'practical',
                            text: 'Write a Javascript validation function verifyIntegrityHash(chain) that loops through a list of blocks, recalculates each SHA-256 hash using crypto.subtle, and asserts matching prevHash links. Return boolean status.',
                            starterCode: `async function verifyIntegrityHash(chain) {\n    // Implement blockchain verification logic here\n    for(let i = 1; i < chain.length; i++) {\n        \n    }\n    return true;\n}`,
                            points: 20
                        }
                    ],
                    active: false,
                    published: false
                }
            ];
            localStorage.setItem('NEXUS_EXAMS', JSON.stringify(defaultExams));
        }

        if (!localStorage.getItem('NEXUS_STUDENTS_STATE')) {
            const studentStates = {
                'student@nexus.edu': {
                    warnings: 0,
                    riskScore: 4, // out of 100 base risk
                    status: 'online',
                    logs: [],
                    typingHistory: []
                }
            };
            localStorage.setItem('NEXUS_STUDENTS_STATE', JSON.stringify(studentStates));
        }

        if (!localStorage.getItem('NEXUS_WALLET_BALANCE')) {
            localStorage.setItem('NEXUS_WALLET_BALANCE', '12500'); // Muted gold tokens/credits for AI compute
        }
    },

    getExams() {
        return JSON.parse(localStorage.getItem('NEXUS_EXAMS') || '[]');
    },

    saveExams(exams) {
        localStorage.setItem('NEXUS_EXAMS', JSON.stringify(exams));
    },

    getStudentState(email) {
        const states = JSON.parse(localStorage.getItem('NEXUS_STUDENTS_STATE') || '{}');
        return states[email] || { warnings: 0, riskScore: 0, status: 'unknown', logs: [], typingHistory: [] };
    },

    updateStudentState(email, newState) {
        const states = JSON.parse(localStorage.getItem('NEXUS_STUDENTS_STATE') || '{}');
        states[email] = { ...(states[email] || {}), ...newState };
        localStorage.setItem('NEXUS_STUDENTS_STATE', JSON.stringify(states));
        window.dispatchEvent(new CustomEvent('nexus-student-update', { detail: { email, state: states[email] } }));
    },

    getWalletBalance() {
        return parseInt(localStorage.getItem('NEXUS_WALLET_BALANCE') || '0', 10);
    },

    deductWallet(amount) {
        let bal = this.getWalletBalance();
        bal = Math.max(0, bal - amount);
        localStorage.setItem('NEXUS_WALLET_BALANCE', bal.toString());
        window.dispatchEvent(new CustomEvent('nexus-wallet-update', { detail: { balance: bal } }));
        return bal;
    },

    // Offline caching & Sync engine
    getOfflineQueue() {
        return JSON.parse(localStorage.getItem('NEXUS_OFFLINE_QUEUE') || '[]');
    },

    addToOfflineQueue(examId, questionId, response, timestamp) {
        const queue = this.getOfflineQueue();
        // Remove existing queue item for same question to avoid duplicates
        const filtered = queue.filter(item => !(item.examId === examId && item.questionId === questionId));
        filtered.push({ examId, questionId, response, timestamp });
        localStorage.setItem('NEXUS_OFFLINE_QUEUE', JSON.stringify(filtered));
    },

    clearOfflineQueue() {
        localStorage.setItem('NEXUS_OFFLINE_QUEUE', JSON.stringify([]));
    }
};

// Initial run
NexusDB.initialize();
window.NexusDB = NexusDB;
