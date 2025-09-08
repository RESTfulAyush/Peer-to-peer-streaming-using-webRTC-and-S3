
# 🎥 DuoCast — Two-Person Video Calling with Local Recording & S3 Upload

## 💡 Idea Behind the Project

**DuoCast** was built to solve a common issue in WebRTC-based video calls:

When network conditions are poor (e.g., low bandwidth, packet loss), the video becomes choppy and laggy because WebRTC uses **UDP**, which prioritizes speed over reliability.

This affects **call quality** and makes any real-time recording unreliable if captured from the network stream.

---

## ❗ The Challenge

* **UDP-based WebRTC calls** don’t guarantee consistent video quality during poor connectivity.
* **Recording remote streams** (via WebRTC) captures these same lags, freezes, or resolution drops.
* Users end up with degraded video quality in their recordings, especially if one side had a bad connection.

---

## ✅ The Solution

Instead of recording the WebRTC stream, we changed the model:

1. Each participant **records their own local video stream** in high quality using the `MediaRecorder` API.
2. The recordings are **split into chunks** (e.g. every 2 seconds) and **uploaded to AWS S3** in the background.
3. After the call ends, the backend **downloads the chunks from both users** and merges them into a **final video** showing both participants side by side.
4. The final merged video uses each user's original local recording — not the lossy streamed version — giving **higher quality and better sync**, even in poor network conditions.

---

## 🚧 Current State

* ✅ Local recording and background chunk uploads work reliably.
* ⚠️ Server-side **merge logic** (FFmpeg-based) is **experimental** and requires improvement (sync, alignment).
* 🧪 The app demonstrates the concept but is not production-ready yet.
