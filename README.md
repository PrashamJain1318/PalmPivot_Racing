# PalmPivot Racing 🏎️
### AI-Powered Hand Gesture Racing Experience

PalmPivot Racing is a premium arcade racing game powered by React, Next.js, Three.js, React Three Fiber, Rapier Physics, and MediaPipe Hand Gesture Recognition.

---

## 🚀 How to Deploy on Vercel (Important)

Because this repository has a monorepo-style structure where the Next.js application resides inside the `client/` subdirectory, deploying the root directory directly will result in a **404: NOT_FOUND** error on Vercel.

To deploy the project successfully:

1. Go to your **Vercel Dashboard** and click on your project.
2. Go to **Settings** -> **General**.
3. Locate the **Root Directory** field and change it from `.` (the root) to **`client`**.
4. Keep the **Framework Preset** as **Next.js** (Vercel will auto-detect this once the Root Directory is set to `client`).
5. Save the settings and trigger a **Redeploy** of your latest commit.

Once Vercel builds the project from the `client` directory, the website will load perfectly!

---

## 🎮 Arcade Gesture Controls

- **Steer Left/Right**: Hold both hands up in front of the webcam and rotate them like a steering wheel.
- **Acceleration**: Automatic! Sit back and focus on hitting the apexes.
- **Warp / Nitro Boost**: Collect nitro canisters along the highway to trigger warp speed.

---

## 🛠️ Tech Stack
- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion
- **3D Graphics**: Three.js, React Three Fiber, `@react-three/drei`
- **Physics**: `@react-three/rapier` (WASM physics engine)
- **Computer Vision**: Google MediaPipe hands detection
