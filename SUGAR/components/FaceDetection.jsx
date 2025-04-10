"use client";

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceDetection = ({ onFaceStatus, isFullscreen, isPaused }) => {

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const busyRef = useRef(false);
  
  const [faceDetected, setFaceDetected] = useState(false); 
  const [modelLoaded, setModelLoaded] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const faceCountRef = useRef(0);
  const noFaceCountRef = useRef(0);
  

  useEffect(() => {
    async function loadModels() {
      try {
        console.log("Loading face detection models...");
        
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        
        console.log("Face detection models loaded successfully!");
        setModelLoaded(true);
      } catch (error) {
        console.error("Failed to load face detection models:", error);
      }
    }
    
    loadModels();
    
    setShowDebug(true);
    const debugTimer = setTimeout(() => setShowDebug(false), 10000);
    
    return () => clearTimeout(debugTimer);
  }, []);
  
  useEffect(() => {
    async function setupCamera() {
      if (!modelLoaded) return;
      
      try {

        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
        
        console.log("Starting camera...");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 320 },
              height: { ideal: 240 }
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().catch(e => console.error("Video play error:", e));
            };
            console.log("Camera started successfully");

            setShowDebug(true);
            setTimeout(() => setShowDebug(false), 8000);

            if (typeof window !== 'undefined') {
              window.__cameraPermissionGranted = true;
            }
          }
        } catch (permissionError) {
          console.error("Camera permission denied:", permissionError);
          

          console.warn("Face detection requires camera permissions.");
          
          if (typeof window !== 'undefined') {
            window.__cameraPermissionGranted = false;
          }
        }
      } catch (error) {
        console.error("Error starting camera:", error);
      }
    }
    
    setupCamera();
    
    return () => {

      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [modelLoaded]);

  useEffect(() => {

    if (!modelLoaded) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
 
    if (isPaused && !window.__faceAutoDetectionPause) {
      console.log("Timer manually paused - stopping face detection");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    if (!isPaused || window.__faceAutoDetectionPause) {
      
      faceCountRef.current = 0;
      noFaceCountRef.current = 0;
    
      
      if (!intervalRef.current) {
        console.log("Starting face detection interval...");
      
        intervalRef.current = setInterval(detectFace, 400);
        
       
        detectFace();
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [modelLoaded, isPaused, faceDetected, showDebug]);
  

  useEffect(() => {
    if (!isPaused) {
      window.__faceAutoDetectionPause = false;
    }
  }, [isPaused]);
 
  useEffect(() => {
   
    if (typeof window !== 'undefined' && window) {
      window.__faceAutoDetectionPause = window.__faceAutoDetectionPause || false;
    }
    
    return () => {
      if (typeof window !== 'undefined' && window) {
        window.__faceAutoDetectionPause = false;
      }
    };
  }, []);
  
  
  async function detectFace() {
    if (busyRef.current || !videoRef.current || !videoRef.current.readyState || !canvasRef.current) return;
  
    busyRef.current = true;
    
    try {
  
      const options = new faceapi.TinyFaceDetectorOptions({ 
        minConfidence: 0.5, 
        inputSize: 160      
      });
      
      const detection = await faceapi.detectSingleFace(videoRef.current, options);
      const isFaceVisible = !!detection;
      
     
      const confidenceScore = detection ? detection.score : 0;
      console.log(`Face detection: ${isFaceVisible ? 'FOUND' : 'NOT FOUND'}, Confidence: ${confidenceScore.toFixed(2)}`);
      
     
      if (showDebug && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (detection) {
         
          const displaySize = { 
            width: videoRef.current.videoWidth || 320, 
            height: videoRef.current.videoHeight || 240 
          };
          faceapi.matchDimensions(canvasRef.current, displaySize);
          
      
          const resizedDetections = faceapi.resizeResults(detection, displaySize);
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          
         
          ctx.font = '14px Arial';
          ctx.fillStyle = 'green';
          ctx.fillText(`Confidence: ${confidenceScore.toFixed(2)}`, 10, 20);
        } else {
         
          ctx.font = '18px Arial';
          ctx.fillStyle = 'red';
          ctx.fillText('No Face Detected', 10, 30);
        }
      }
    
      if (isFaceVisible && confidenceScore > 0.5) {
        faceCountRef.current++;
        noFaceCountRef.current = 0;
      
        if (!faceDetected && faceCountRef.current >= 2) {
          console.log("✅ FACE CONFIRMED: Updating state to FACE DETECTED");
          setFaceDetected(true);
          onFaceStatus(true);
        }
      } else {
        noFaceCountRef.current++;
        faceCountRef.current = 0;
       
        if (faceDetected && noFaceCountRef.current >= 2) {
          console.log("❌ NO FACE CONFIRMED: Updating state to FACE NOT DETECTED");
          setFaceDetected(false);
          onFaceStatus(false);
        }
      }
    } catch (error) {
      console.error("Error in face detection:", error);
    } finally {
     
      busyRef.current = false;
    }
  }

  const toggleDebug = () => {
    setShowDebug(prev => !prev);
  };
  
  return (
    <div className="face-detection-container">
      {/* Video element - hidden by default, shown when debugging */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={320}
        height={240}
        onLoadedMetadata={() => console.log("Video loaded and ready")}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          width: showDebug ? '240px' : '2px',
          height: showDebug ? '180px' : '2px',
          borderRadius: '8px',
          border: faceDetected ? '3px solid #4ade80' : '3px solid #ef4444',
          opacity: showDebug ? 0.9 : 0.01,
          zIndex: 999,
          transition: 'all 0.3s ease',
          transform: 'scaleX(-1)' 
        }}
      />
      
      {/* Canvas for drawing face detection - only visible in debug mode */}
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          width: showDebug ? '240px' : '2px',
          height: showDebug ? '180px' : '2px',
          zIndex: 1000,
          opacity: showDebug ? 1 : 0,
          pointerEvents: 'none',
          transform: 'scaleX(-1)'
        }}
      />
      
      {/* Debug toggle button - always visible */}
      <div
        onClick={toggleDebug}
        style={{
          position: 'fixed',
          bottom: 10,
          right: showDebug ? '260px' : '10px',
          backgroundColor: faceDetected ? 'rgba(74, 222, 128, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          fontWeight: 'bold',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '13px',
          cursor: 'pointer',
          zIndex: 1001,
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}
      >
        {faceDetected ? 
          <>👤 Face Detected {showDebug && '(Debug Mode)'}</> : 
          <>❌ No Face Detected {showDebug && '(Debug Mode)'}</>
        }
      </div>
    </div>
  );
};

export default FaceDetection; 
