# WebRTC Audio Call

A simple, production-ready WebRTC audio calling application that works directly in the browser. No plugins or installations required!

## 🌐 Live Demo
[Click here to try it live](https://your-username.github.io/webrtc-audio-call/)

## 🚀 Features

- **Peer-to-peer audio calls** - Direct browser-to-browser communication
- **No installation required** - Works in modern browsers
- **High-quality audio** - Opus codec with echo cancellation
- **Secure** - End-to-end encrypted (SRTP)
- **Responsive design** - Works on desktop and mobile
- **Real-time status** - Visual call state indicators
- **Volume controls** - Adjust microphone and speaker levels

## 📋 Prerequisites

- Modern browser (Chrome 60+, Firefox 55+, Safari 11+, Edge 79+)
- Microphone access
- HTTPS connection (for GitHub Pages)

## 🎯 Quick Start

1. **Open the app**: Visit the GitHub Pages link
2. **Start a call**: Click "Start Call" on the first device
3. **Join the call**: Open the same link on another device and click "Answer Call"
4. **Speak!**: You should now have a working audio call

## 🛠️ Local Development

### Option 1: Use Public Signaling Server (Recommended)
The app comes pre-configured with a public signaling server. Just open `index.html` in a browser.

### Option 2: Run Your Own Signaling Server
```bash
# Navigate to signaling server directory
cd signaling-server

# Install dependencies
npm install

# Start the server
npm start

# The server will run at ws://localhost:8080
