export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureResult {
  gesture: 'neutral' | 'steer_left' | 'steer_right' | 'accelerate' | 'brake' | 'nitro' | 'handbrake' | 'horn' | 'pause' | 'reset_cam';
  confidence: number;
  steeringAngle: number; // -1 to 1
}

// Distance helper
export function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

// Check if a finger is extended
export function isFingerExtended(tip: Landmark, pip: Landmark, mcp: Landmark, wrist: Landmark): boolean {
  // If the distance from tip to wrist is greater than pip to wrist, it is extended
  const dTip = getDistance(tip, wrist);
  const dPip = getDistance(pip, wrist);
  const dMcp = getDistance(mcp, wrist);
  
  return dTip > dPip && dPip > dMcp;
}

export function classifyHandGesture(landmarks: Landmark[], isLeftHand: boolean): GestureResult {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: 'neutral', confidence: 0, steeringAngle: 0 };
  }

  const wrist = landmarks[0];
  
  // Finger landmarks:
  // Thumb: 1-4 (4 is tip)
  // Index: 5-8 (8 is tip)
  // Middle: 9-12 (12 is tip)
  // Ring: 13-16 (16 is tip)
  // Pinky: 17-20 (20 is tip)
  
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];
  
  const indexTip = landmarks[8];
  const indexPIP = landmarks[7];
  const indexMCP = landmarks[5];
  
  const middleTip = landmarks[12];
  const middlePIP = landmarks[11];
  const middleMCP = landmarks[9];
  
  const ringTip = landmarks[16];
  const ringPIP = landmarks[15];
  const ringMCP = landmarks[13];
  
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[19];
  const pinkyMCP = landmarks[17];

  // 1. Determine finger extensions
  const indexExtended = isFingerExtended(indexTip, indexPIP, indexMCP, wrist);
  const middleExtended = isFingerExtended(middleTip, middlePIP, middleMCP, wrist);
  const ringExtended = isFingerExtended(ringTip, ringPIP, ringMCP, wrist);
  const pinkyExtended = isFingerExtended(pinkyTip, pinkyPIP, pinkyMCP, wrist);
  
  // Thumb extension is calculated relative to index MCP
  const thumbExtended = getDistance(thumbTip, indexMCP) > getDistance(thumbIP, indexMCP);

  // 2. Calculate Palm Roll (for Steering)
  // We use the slope between index MCP (5) and pinky MCP (17)
  const dx = pinkyMCP.x - indexMCP.x;
  const dy = pinkyMCP.y - indexMCP.y;
  let rollAngle = Math.atan2(dy, dx); // in radians
  
  // Invert roll calculation if it's the left hand (since pinky/index are swapped)
  if (isLeftHand) {
    rollAngle = -rollAngle;
  }

  // Normalize steering angle: if horizontal (0 rad), steering is 0.
  // Tilt of ~45 degrees (0.78 rad) represents full steer.
  // Limit to -1 to 1.
  let steeringAngle = -rollAngle / 0.55; // Adjust divisor for sensitivity
  if (Math.abs(steeringAngle) < 0.12) steeringAngle = 0; // deadzone
  steeringAngle = Math.max(-1, Math.min(1, steeringAngle));

  // 3. Match gestures
  
  // FIST (Handbrake) - all fingers folded
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended) {
    return { gesture: 'handbrake', confidence: 0.95, steeringAngle };
  }

  // VICTORY (Pause) - index and middle extended, ring and pinky folded
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return { gesture: 'pause', confidence: 0.9, steeringAngle };
  }

  // THUMBS UP (Nitro) - thumb extended up, other fingers folded
  const isThumbPointingUp = thumbTip.y < thumbIP.y && thumbIP.y < thumbMCP.y;
  if (thumbExtended && isThumbPointingUp && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { gesture: 'nitro', confidence: 0.95, steeringAngle };
  }

  // PINCH (Horn) - thumb tip and index tip are touching
  const thumbIndexDist = getDistance(thumbTip, indexTip);
  if (thumbIndexDist < 0.05 && middleExtended && ringExtended) {
    return { gesture: 'horn', confidence: 0.85, steeringAngle };
  }

  // OPEN PALM (Accelerate) - all extended
  if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
    // If hand is pushed/tilted forward (wrist higher than fingers), trigger Brake
    const fingersMidpointY = (indexTip.y + middleTip.y + ringTip.y + pinkyTip.y) / 4;
    
    if (wrist.y < fingersMidpointY - 0.05) {
      return { gesture: 'brake', confidence: 0.8, steeringAngle };
    }
    
    return { gesture: 'accelerate', confidence: 0.9, steeringAngle };
  }

  // Default Steering/Neutral state
  if (Math.abs(steeringAngle) > 0.25) {
    return {
      gesture: steeringAngle > 0 ? 'steer_right' : 'steer_left',
      confidence: 0.8,
      steeringAngle
    };
  }

  return { gesture: 'neutral', confidence: 0.7, steeringAngle };
}
