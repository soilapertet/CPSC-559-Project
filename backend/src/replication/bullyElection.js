// Bully Leader Election Algorithm
import { config } from '../config/config.js';
import { initializeFollowerStatus, getFollowerStatus, sendHeartbeats } from './leader.js';

const ELECTION_TIMEOUT_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

const state = {
    currentLeaderUrl: null,
    isRunningElection: false,
    receivedBully: false,
    heartbeatTimer: null,
    isLeader: false,
};

// ID = Port Number
function myId() {
    return parseInt(config.port, 10);
}
function myUrl() {
    return `http://localhost:${config.port}`;
}

// All known nodes: leader and followers
function getAllNodes() {
    const urls = [
        config.leader?.url,
        ...config.followers.filter(Boolean),
    ];
    const unique = [...new Set(urls.filter(Boolean).map(u => u.trim()))];
    return unique.map(url => ({ url, id: parseInt(new URL(url).port, 10) }))
        .sort((a, b) => a.id - b.id);
}

function higherNodes() {
    return getAllNodes().filter(n => n.id > myId());
}

function lowerNodes() {
    return getAllNodes().filter(n => n.id < myId());
}

// Logic to remove dead leader from node list
function handleDeadLeader(deadUrl) {

    // Update status of previous leader to dead -> alive: false
    getFollowerStatus().set(deadUrl, { alive: false, retries: MAX_RETRIES });

    // Remove dead old leader from followers list
    config.followers = config.followers.filter(Boolean).filter(url => url != deadUrl);
    console.log(`[Election:${myId()}] Removed dead leader ${deadUrl} from node list.`);
    // notifyFrontend(deadUrl)
}

async function sendMessage(url, type, payload = {}) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ELECTION_TIMEOUT_MS);
        const res = await fetch(`${url}/election/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromId: myId(), fromUrl: myUrl(), ...payload }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        return res.ok;
    } catch {
        return false;
    }
}

async function failureDetector(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ELECTION_TIMEOUT_MS);
        const res = await fetch(`${url}/election/ping`, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);
        return !res.ok;
    } catch {
        return true;
    }
}

// Election Logic 
export async function initiateElection() {
    if (state.isLeader || state.currentLeaderUrl) return;
    if (state.isRunningElection) return;

    console.log(`[Election:${myId()}] Starting election (Bully Algorithm).`);
    state.isRunningElection = true;
    state.receivedBully = false;

    const higher = higherNodes();

    if (higher.length === 0) {
        console.log(`[Election:${myId()}] I have the highest ID. Declaring myself leader.`);
        await declareLeader();
        return;
    }

    await Promise.allSettled(higher.map(n => sendMessage(n.url, 'election')));

    // Wait for bully responses
    await new Promise(resolve => setTimeout(resolve, ELECTION_TIMEOUT_MS));

    if (!state.receivedBully && !state.currentLeaderUrl) {
        console.log(`[Election:${myId()}] No bully received. I am the new leader!`);
        await declareLeader();
    } else if (state.receivedBully) {
        console.log(`[Election:${myId()}] Bully received. Waiting for leader announcement.`);
    }

    state.isRunningElection = false;

    // retry election if no leader appears
    setTimeout(async () => {
        if (!state.isLeader && !state.currentLeaderUrl) {
            console.log(`[Election:${myId()}] No leader announced. Re-initiating election.`);
            await initiateElection();
        }
    }, ELECTION_TIMEOUT_MS * 2);
}

async function declareLeader() {
    state.currentLeaderUrl = myUrl();
    state.isLeader = true;
    state.isRunningElection = false;
    config.role = 'leader';
    config.leader = { url: myUrl() };

    console.log(`[Election:${myId()}] Broadcasting 'leader' to all nodes.`);
    const others = getAllNodes().filter(n => n.id !== myId());

    await Promise.allSettled(
        others.map(n => sendMessage(n.url, 'leader', { leaderUrl: myUrl(), leaderId: myId() }))
    );

    startLeaderHeartbeat();
}

// Message Handlers 
export async function handleElectionMessage(fromId, fromUrl) {
    console.log(`[Election:${myId()}] Received 'election' from node ${fromId}.`);
    if (myId() > fromId) {
        console.log(`[Election:${myId()}] Sending 'bully' to node ${fromId}.`);
        await sendMessage(fromUrl, 'bully');
        if (!state.isRunningElection) await initiateElection();
    }
}

export function handleBullyMessage(fromId) {
    console.log(`[Election:${myId()}] Received 'bully' from node ${fromId}. Stepping down.`);
    state.receivedBully = true;
    state.isRunningElection = false;
}

export function handleLeaderMessage(leaderId, leaderUrl) {
    console.log(`[Election:${myId()}] Received 'leader' announcement: node ${leaderId} (${leaderUrl}).`);
    state.currentLeaderUrl = leaderUrl;
    state.receivedBully = false;
    state.isRunningElection = false;

    if (myId() === leaderId) {
        state.isLeader = true;
        config.role = 'leader';
        startLeaderHeartbeat();
    } else {
        state.isLeader = false;
        config.role = 'follower';
        stopLeaderHeartbeat();
        startFollowerHeartbeat();
    }
}

// Heartbeats 
function startLeaderHeartbeat() {
    stopLeaderHeartbeat();
    initializeFollowerStatus();                                                         // initialise map to keep track of followers' status   
    state.heartbeatTimer = setInterval(sendHeartbeats, HEARTBEAT_INTERVAL_MS);          // monitor follower nodes
    console.log(`[Election:${myId()}] Started leader heartbeat monitoring.`);
}

function stopLeaderHeartbeat() {
    if (state.heartbeatTimer) {
        clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = null;
    }
}

function startFollowerHeartbeat() {
    stopLeaderHeartbeat();
    state.heartbeatTimer = setInterval(async () => {
        const leaderUrl = state.currentLeaderUrl || config.leader?.url;
        if (!leaderUrl) return;

        const crashed = await failureDetector(leaderUrl);
        if (crashed) {
            console.log(`[Election:${myId()}] Leader at ${leaderUrl} appears crashed!`);
            handleDeadLeader(leaderUrl);
            state.currentLeaderUrl = null;
            stopLeaderHeartbeat();
            await initiateElection();
        }
    }, HEARTBEAT_INTERVAL_MS);
}

// Initial Election 
export async function startInitialElection() {
    const knownNodes = [
        ...config.followers.filter(Boolean),
        config.leader?.url
    ].filter(Boolean);

    let foundLeader = false;
    for (const url of knownNodes) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${url}/election/ping`, { method: 'GET', signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) continue;

            const infoRes = await fetch(`${url}/election/leader-info`);
            if (!infoRes.ok) continue;
            const info = await infoRes.json();
            if (info?.leaderUrl) {
                state.currentLeaderUrl = info.leaderUrl;
                config.role = 'follower';
                startFollowerHeartbeat();
                console.log(`[Election:${myId()}] Starting as FOLLOWER. Found existing leader at ${info.leaderUrl}`);
                foundLeader = true;
                break;
            }
        } catch {
            continue;
        }
    }

    if (!foundLeader) {
        console.log(`[Election:${myId()}] No leader detected. Starting as FOLLOWER with potential election.`);
        startFollowerHeartbeat();
        const delay = 500 + Math.floor(Math.random() * 500);
        setTimeout(async () => {
            if (!state.currentLeaderUrl) {
                console.log(`[Election:${myId()}] No leader detected. Initiating first election.`);
                await initiateElection();
            }
        }, delay);
    } else if (config.role === 'leader') {
        console.log(`[Election:${myId()}] Starting as LEADER. Broadcasting leadership.`);
        await declareLeader();
    }
}

// Status 
export function getElectionState() {
    return {
        myId: myId(),
        myUrl: myUrl(),
        role: config.role,
        currentLeaderUrl: state.currentLeaderUrl || null,
        isLeader: state.isLeader,
        isRunningElection: state.isRunningElection,
        allNodes: getAllNodes(),
    };
}