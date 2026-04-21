// Bully Leader Election Algorithm
import { config } from '../config/config.js';
import OperationLog from '../models/OperationLog.js';
import { notifyFrontend } from '../routes/eventRoute.js';
import { syncFromLeader } from './follower.js';
import { initializeFollowerStatus, getFollowerStatus, sendHeartbeats, initializeCounter } from './leader.js';

const ELECTION_TIMEOUT_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

let leaderLog = null;
let leaderSeq = 0;

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
    return config.nodes.find(url => new URL(url).port == config.port);
}

// All known nodes: leader and followers
function getAllNodes() {

    const urls = config.nodes.filter(Boolean);
    const unique = [...new Set(urls.filter(Boolean).map(u => u.trim()))];
    return unique.map(url => ({ url, id: parseInt(new URL(url).port, 10) }))
        .sort((a, b) => a.id - b.id);
}

function higherNodes() {
    return getAllNodes().filter(n => n.id > myId());
}

// Logic to remove dead leader from node list
function handleDeadLeader(deadUrl) {

    // Update status of previous leader to dead -> alive: false
    getFollowerStatus().set(deadUrl, { alive: false, retries: MAX_RETRIES });

    console.log(`[Election:${myId()}] Notifying frontend of dead leader.`);

    // Notify frontend of dead leader to remove from node pool
    // Named event: leader-dead
    // Pass dead leader url to frontend
    notifyFrontend({
        type: 'leader-dead',
        url: deadUrl,
    })
}

// Add a getter method to get the elected leader's url
export function getLeaderUrl() {
    return state.currentLeaderUrl;
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

    // Initialize counter when becoming leader
    await initializeCounter();
    
    // Get the current log entry for new leader
    leaderLog = await OperationLog.findOne().sort({ seq: -1 });
    leaderSeq = leaderLog ? leaderLog.seq : 0;

    console.log(`[Election:${myId()}] Broadcasting 'leader' to all nodes.`);
    const others = getAllNodes().filter(n => n.id !== myId());

    await Promise.allSettled(
        others.map(n => sendMessage(n.url, 'leader', {
            leaderUrl: myUrl(),
            leaderId: myId(),
            leaderSeq : leaderSeq,
        }))
    );

    // Notify frontned of the new leader
    // Named event: new-leader
    // Pass new leader url to frontend
    notifyFrontend({
        type: 'new-leader',
        url: myUrl(),
    });

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

export async function handleLeaderMessage(leaderId, leaderUrl, leaderSeq) {

    console.log(`[Election:${myId()}] Received 'leader' announcement: Node ${leaderId} (${leaderUrl}). Current Seq ${leaderSeq}`);

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

    const lastAppliedLog = await OperationLog.findOne().sort({ seq: -1 });
    const lastAppliedSeq = lastAppliedLog ? lastAppliedLog.seq : 0;

    // Start syncing process with current leader if node is behind on logs
    if(!state.isLeader && lastAppliedSeq < leaderSeq) {
        
        console.log(`[Follower ${myUrl()}] Syncing logs after leader election. Syncing seq  ${leaderSeq}.`)
        
        try {
            await syncFromLeader(leaderUrl);
        } catch (err) {
            console.error(`[Follower ${myUrl()}] Failed to sync ${myUrl()}: ${err.message}`);
        }
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
        const leaderUrl = state.currentLeaderUrl;
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

    const knownNodes = config.nodes.filter(Boolean);

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

            console.log(`[Election:${myId()}] Checking leader-info from ${url}: ${JSON.stringify(info)}`);
            
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