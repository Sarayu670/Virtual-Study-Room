"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import { BsArrowRight, BsArrowLeft } from "react-icons/bs";
import localFont from 'next/font/local';
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import FaceDetection from "@/components/FaceDetection";
import SugaiAI from "../../components/SugaiAI";
import NoteSummarizer from "../../components/NoteSummarizer";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function StudyRoomPage() {
  const [pdfFile, setPdfFile] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(25);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(0);
  const [breakInterval, setBreakInterval] = useState(25);
  const [breakIntervalSeconds, setBreakIntervalSeconds] = useState(0);
  const [breakDuration, setBreakDuration] = useState(5);
  const [breakDurationSeconds, setBreakDurationSeconds] = useState(0);
  const [timer, setTimer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isBreak, setIsBreak] = useState(false);
  const [showBreakNotification, setShowBreakNotification] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const [waitingForPdfAfterRestore, setWaitingForPdfAfterRestore] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showSummarizer, setShowSummarizer] = useState(false);
  
  const [playingMusic, setPlayingMusic] = useState(false);
  const [selectedMusicType, setSelectedMusicType] = useState("lofi");
  const audioRef = useRef(null);
  
  const [focusMode, setFocusMode] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  
  const [tabSwitches, setTabSwitches] = useState(0);
  
  const pdfDocRef = useRef(null);
  
  const [studyGoal, setStudyGoal] = useState(10);
  const [pagesRead, setPagesRead] = useState(0);
  
  
  const musicOptions = {
    lofi: "https://stream.zeno.fm/0r0xa792kwzuv",
    classical: "https://stream.zeno.fm/d553pahd84zuv",
    nature: "https://stream.zeno.fm/n53wu8h2tc9uv",
    whitenoise: "https://stream.zeno.fm/huwsfsp8yfhvv"
  };
  
 
  const [facePresent, setFacePresent] = useState(false);
  const [faceDetectionEnabled, setFaceDetectionEnabled] = useState(true);
  const [autoFacePause, setAutoFacePause] = useState(false);
  const [showFaceAlert, setShowFaceAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("Timer paused - no face detected");
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const faceTimeoutRef = useRef(null);
  
  const pauseSoundRef = useRef(null);
  const resumeSoundRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const prevFaceStatusRef = useRef(false);
  
  useEffect(() => {
    
    setSessionDuration(25); 
    
    if (typeof window !== 'undefined') {
     
      pauseSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      resumeSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1518/1518-preview.mp3');
      
    
      if (pauseSoundRef.current) pauseSoundRef.current.volume = 0.3;
      if (resumeSoundRef.current) resumeSoundRef.current.volume = 0.3;
    }
    
    return () => {
      
      pauseSoundRef.current = null;
      resumeSoundRef.current = null;
    };
  }, []);
 
  useEffect(() => {
    const savedSessionData = localStorage.getItem('pausedStudySession');
    if (savedSessionData) {
      try {
        const parsedSession = JSON.parse(savedSessionData);
        setSavedSession(parsedSession);
        setShowRecoveryDialog(true);
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem('pausedStudySession');
      }
    }
  }, []);

  const restoreSavedSession = () => {
    if (!savedSession) return;
    
   
    setTimeLeft(savedSession.timeLeft);
    setSessionDuration(savedSession.sessionDuration);
    setBreakInterval(savedSession.breakInterval);
    setBreakDuration(savedSession.breakDuration);
    setIsBreak(savedSession.isBreak);
    setPagesRead(savedSession.pagesRead);
    setStudyGoal(savedSession.studyGoal);
    if (savedSession.notes) setNotes(savedSession.notes);
   
    localStorage.removeItem('pausedStudySession');
    setShowRecoveryDialog(false);
    
    
    setWaitingForPdfAfterRestore(true);
    
   
    alert("Please re-upload your PDF file to continue your study session");
    
   
    setIsPaused(false);
  };

  const startNewSession = () => {
    localStorage.removeItem('pausedStudySession');
    setSavedSession(null);
    setShowRecoveryDialog(false);
  };

  const handleFiles = (files) => {
    const file = files[0];
    if (file?.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    console.log("Loading PDF file...");
    const fileReader = new FileReader();
    fileReader.onload = function() {
     
      setPdfFile(fileReader.result);
      
      const totalSessionMinutes = sessionDuration + (sessionDurationSeconds / 60);
      
      setSessionDuration(totalSessionMinutes);
      
      console.log("PDF loaded successfully, starting timer...");
      
      if (!waitingForPdfAfterRestore) {
        startTimer();
      } else {
       
        setWaitingForPdfAfterRestore(false);
      }
      
      document.body.addEventListener('click', function tryFullscreen() {
        
        document.body.removeEventListener('click', tryFullscreen);
        
        console.log("User clicked - attempting fullscreen from user gesture");
        
        try {
          const docElement = document.documentElement;
          if (docElement.requestFullscreen) {
            docElement.requestFullscreen()
              .then(() => {
                console.log("Fullscreen activated successfully after PDF upload");
                setIsFullscreen(true);
              })
              .catch(err => {
                console.error("Fullscreen error:", err);
                setIsFullscreen(false);
              });
          } else if (docElement.mozRequestFullScreen) {
            docElement.mozRequestFullScreen();
            setIsFullscreen(true);
          } else if (docElement.webkitRequestFullscreen) {
            docElement.webkitRequestFullscreen();
            setIsFullscreen(true);
          } else if (docElement.msRequestFullscreen) {
            docElement.msRequestFullscreen();
            setIsFullscreen(true);
          }
        } catch (err) {
          console.error("Error requesting fullscreen:", err);
        }
      }, { once: true });
      
      const messageDiv = document.createElement('div');
      messageDiv.innerText = 'Click anywhere on the screen to enter fullscreen mode';
      messageDiv.style.position = 'fixed';
      messageDiv.style.top = '50%';
      messageDiv.style.left = '50%';
      messageDiv.style.transform = 'translate(-50%, -50%)';
      messageDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      messageDiv.style.color = 'white';
      messageDiv.style.padding = '20px';
      messageDiv.style.borderRadius = '8px';
      messageDiv.style.zIndex = '9999';
      messageDiv.style.transition = 'opacity 0.5s';
      document.body.appendChild(messageDiv);
    
      setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(messageDiv);
        }, 500);
      }, 3000);
    };
    fileReader.readAsArrayBuffer(file);
  };

  const startTimer = () => {
    console.log("Starting new timer...");
    
    if (timer) {
      clearInterval(timer);
    }
    
    setElapsedTime(0);
   
    const totalSessionSeconds = sessionDuration * 60;
    setTimeLeft(totalSessionSeconds);
    
    const newInterval = setInterval(() => {
      setElapsedTime(prevTime => {
        const newTime = prevTime + 1;
        const totalSessionSeconds = sessionDuration * 60;
        
        setTimeLeft(Math.max(0, totalSessionSeconds - newTime));
        
        if (newTime >= totalSessionSeconds) {
          console.log("Session complete");
          clearInterval(newInterval);
          setTimer(null);
          
          return totalSessionSeconds; 
        }
       
        if (!isBreak && breakInterval > 0 && newTime % (breakInterval * 60) === 0) {
          console.log("Break interval reached");
          clearInterval(newInterval);
          setTimer(null);
            setIsBreak(true);
          setShowBreakNotification(true);
          
          const breakTimeSeconds = (breakDuration * 60) + parseInt(breakDurationSeconds || 0);
          setTimeLeft(breakTimeSeconds);
          
          playSound('/notification.mp3');
        }
        
        return newTime;
      });
    }, 1000);
    
    setTimer(newInterval);
    
    return newInterval;
  };

  const formatTimeDisplay = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const formatTimeHMS = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    } else {
      return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("border-pink-400");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-pink-400");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-pink-400");
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement || 
                                   !!document.mozFullScreenElement ||
                                   !!document.webkitFullscreenElement || 
                                   !!document.msFullscreenElement;
      
      console.log("Fullscreen changed:", isCurrentlyFullscreen);
      setIsFullscreen(isCurrentlyFullscreen);
     
      if (isCurrentlyFullscreen && faceDetectionEnabled) {
        console.log("Entered fullscreen - activating face detection");
        
        setFaceDetectionEnabled(false);
        setTimeout(() => setFaceDetectionEnabled(true), 100);
      }
      
      if (!isCurrentlyFullscreen && pdfFile && !showExitConfirmation && !isPaused) {
        
        console.log("Exited fullscreen - pausing timer");
        setIsPaused(true);
        setShowPauseDialog(true);
        
        if (timer) {
          clearInterval(timer);
        }
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [pdfFile, showExitConfirmation, isPaused, timer, faceDetectionEnabled]);

  useEffect(() => {
    
    if (isPaused) {
      console.log("Timer paused - clearing interval");
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
    } 
    
    else if (!timer && elapsedTime > 0) {
      console.log("Timer unpaused - restarting");
      startTimer();
    }
  }, [isPaused, timer, elapsedTime]);

  const handleEscapeKey = useCallback((e) => {
    if (e.key === 'Escape') {
      
      if (faceDetectionEnabled && window.__faceAutoDetectionPause && showFaceAlert) {
        e.preventDefault();
        console.log("Preventing exit fullscreen during face detection pause");
        return;
      }
      
      if (isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (document.webkitFullscreenElement) {
          document.webkitExitFullscreen();
        } else if (document.mozFullScreenElement) {
          document.mozCancelFullScreen();
        } else if (document.msFullscreenElement) {
          document.msExitFullscreen();
        }
      }
    }
  }, [faceDetectionEnabled, showFaceAlert, isFullscreen]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    };
  }, []);

 
  useEffect(() => {
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [timer]);

  useEffect(() => {
    if (pdfFile) {
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.async = true;
      
      pdfDocRef.current = null;
      
      script.onload = () => {
       
        const pdfjsLib = window.pdfjsLib;
       
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument(pdfFile);
        loadingTask.promise.then(pdf => {
          pdfDocRef.current = pdf;
          setNumPages(pdf._pdfInfo.numPages);
          
        }).catch(error => {
          console.error("Error loading PDF: ", error);
          alert("Error loading PDF. Please try uploading the file again.");
        });
      };
      
      script.onerror = () => {
        console.error("Failed to load PDF.js library");
        alert("Failed to load PDF viewer. Please refresh the page and try again.");
      };
      
      document.body.appendChild(script);
      
      const style = document.createElement('style');
      style.textContent = `
        .textLayer {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          opacity: 0.2;
          line-height: 1.0;
          pointer-events: auto;
          mix-blend-mode: normal;
          z-index: 1;
        }
        
        .textLayer > div {
          color: transparent;
          cursor: text;
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
        }
        
        /* Custom selection color */
        ::selection {
          background: rgba(255, 105, 180, 0.3) !important;
        }

        canvas {
          display: block !important;
          z-index: 0;
        }
      `;
      document.head.appendChild(style);
     
      return () => {
        try {
          
          if (currentRenderTask.current) {
            currentRenderTask.current.cancel();
            currentRenderTask.current = null;
          }
          
          document.body.removeChild(script);
          document.head.removeChild(style);
        } catch (e) {
         
        }
      };
    }
  }, [pdfFile]);

  const currentRenderTask = useRef(null);

  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(pdfDocRef.current, currentPage);
    }
  }, [currentPage, zoomLevel, rotation]);

  const renderPage = async (pdf, pageNumber) => {
    if (!pdf) return;
    
    if (currentRenderTask.current) {
      try {
        await currentRenderTask.current.cancel();
      } catch (error) {
        console.error("Error cancelling render task:", error);
      }
    }
    
    try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ 
      scale: zoomLevel,
      rotation: rotation 
    });
    
    const canvas = canvasRef.current;
      if (!canvas) return;
      
    const context = canvas.getContext('2d');
    
      const topPadding = 40;
      canvas.height = viewport.height + topPadding;
    canvas.width = viewport.width;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
    
    const renderContext = {
      canvasContext: context,
        viewport: viewport,
        transform: [1, 0, 0, 1, 0, topPadding] 
      };
     
      currentRenderTask.current = page.render(renderContext);
      
      
      await currentRenderTask.current.promise;
     
      currentRenderTask.current = null;
      
     
      if (textLayerRef.current) {
      
        textLayerRef.current.innerHTML = '';
       
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height + topPadding}px`;
        
        try {
         
          const textContent = await page.getTextContent();
          const textDiv = document.createElement('div');
          textDiv.style.position = 'absolute';
          textDiv.style.left = '0';
          textDiv.style.top = '0'; 
          textDiv.style.width = '100%';
          textDiv.style.height = '100%';
          textDiv.style.color = 'transparent';
          textDiv.style.userSelect = 'text';
          textDiv.style.cursor = 'text';
          textDiv.style.pointerEvents = 'all';
          textDiv.style.overflowY = 'visible'; 
          
          let fullText = '';
          textContent.items.forEach(item => {
            fullText += item.str + ' ';
          });
          
          textDiv.textContent = fullText;
          
          textLayerRef.current.appendChild(textDiv);
        } catch (error) {
          console.error('Error rendering text layer:', error);
        }
      }
    
    if (pageNumber > pagesRead) {
      setPagesRead(pageNumber);
      }
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  };
 
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && pdfFile) {
        setTabSwitches(prev => prev + 1);
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pdfFile]);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
    }
  };
  
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  const toggleFocusMode = () => {
    setFocusMode(prev => !prev);
    setShowToolbar(!focusMode);
  };
  
  const toggleMusic = () => {
    if (playingMusic && audioRef.current) {
      try {
        // Add a timeout to avoid instant consecutive play/pause calls
        setTimeout(() => {
      audioRef.current.pause();
        }, 100);
      } catch (err) {
        console.error("Error pausing audio:", err);
      }
    } else {
      try {
      if (!audioRef.current) {
        audioRef.current = new Audio(musicOptions[selectedMusicType]);
        audioRef.current.loop = true;
      }
       
        setTimeout(() => {
          const playPromise = audioRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
               
              })
              .catch(err => {
                console.error("Error playing audio:", err);
              });
          }
        }, 100);
      } catch (err) {
        console.error("Error playing audio:", err);
      }
    }
    setPlayingMusic(prev => !prev);
  };
  
  const changeMusic = (type) => {
    setSelectedMusicType(type);
    if (playingMusic && audioRef.current) {
      try {
        
        const pausePromise = audioRef.current.pause();
        
        setTimeout(() => {
      audioRef.current.src = musicOptions[type];
          
         
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                
              })
              .catch(err => {
                console.error("Error playing new audio:", err);
                
                setPlayingMusic(false);
              });
          }
        }, 200);
      } catch (err) {
        console.error("Error changing music:", err);
      }
    }
  };
  
  const addNote = () => {
    if (currentNote.trim()) {
      const newNote = {
        id: Date.now(),
        text: currentNote,
        page: currentPage,
        timestamp: new Date().toLocaleString()
      };
      setNotes(prev => [...prev, newNote]);
      setCurrentNote("");
    }
  };
  
  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };
  
  const toggleNotes = () => {
    setShowNotes(prev => !prev);
  };
  
 
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!pdfFile || isPaused) return; 
      if (e.key === 'Escape') return; 
      
      switch (e.key) {
        case "ArrowRight":
          goToNextPage();
          break;
        case "ArrowLeft":
          goToPreviousPage();
          break;
        case "+":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "r":
          handleRotate();
          break;
        case "f":
          toggleFocusMode();
          break;
        case "m":
          toggleMusic();
          break;
        case "n":
          toggleNotes();
          break;
        default:
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pdfFile, currentPage, numPages, playingMusic, focusMode, isPaused]);

  const handleContinueStudying = () => {
    console.log("Continuing study session...");
  
    const savedSessionData = localStorage.getItem('sugar-saved-session');
    
    if (savedSessionData) {
      try {
        const savedSession = JSON.parse(savedSessionData);
        console.log("Restored session data:", savedSession);
        
        if (savedSession.sessionDuration) setSessionDuration(savedSession.sessionDuration);
        if (savedSession.elapsedTime) setElapsedTime(savedSession.elapsedTime);
        if (savedSession.timeLeft) setTimeLeft(savedSession.timeLeft);
        if (savedSession.breakInterval) setBreakInterval(savedSession.breakInterval);
        if (savedSession.breakDuration) setBreakDuration(savedSession.breakDuration);
        
        localStorage.removeItem('sugar-saved-session');
      } catch (error) {
        console.error("Error restoring saved session:", error);
      }
    }
    
    setShowExitConfirmation(false);
    setShowPauseDialog(false);
    
    const isCurrentlyFullscreen = !!document.fullscreenElement || 
                                 !!document.mozFullScreenElement ||
                                 !!document.webkitFullscreenElement || 
                                 !!document.msFullscreenElement;
                                 
    if (!isCurrentlyFullscreen) {
      console.log("Requesting fullscreen on continue studying");
      setTimeout(() => {
        try {
          const docElement = document.documentElement;
          if (docElement.requestFullscreen) {
            docElement.requestFullscreen()
              .then(() => {
                console.log("Fullscreen activated successfully");
                setIsFullscreen(true);
              })
              .catch(err => {
                console.error("Fullscreen permission denied:", err);
                alert("Could not enter fullscreen mode. Please use the study features without fullscreen.");
                setIsFullscreen(false);
              });
          } else if (docElement.mozRequestFullScreen) {
            docElement.mozRequestFullScreen()
              .catch(err => {
                console.error("Fullscreen error:", err);
                setIsFullscreen(false);
              });
          } else if (docElement.webkitRequestFullscreen) {
            docElement.webkitRequestFullscreen()
              .catch(err => {
                console.error("Fullscreen error:", err);
                setIsFullscreen(false);
              });
          } else if (docElement.msRequestFullscreen) {
            docElement.msRequestFullscreen()
              .catch(err => {
                console.error("Fullscreen error:", err);
                setIsFullscreen(false);
              });
            } else {
            console.log("No fullscreen API available");
            alert("Your browser doesn't support fullscreen mode. You can still use all features.");
            setIsFullscreen(false);
          }
        } catch (err) {
          console.error("Error requesting fullscreen:", err);
          alert("Could not enter fullscreen mode. You can still use the study features without fullscreen.");
          setIsFullscreen(false);
        }
      }, 100);
    }
    
    setTimeout(() => {
      
      if (isPaused) {
        setIsPaused(false);
      }
      
      if (!timer) {
        console.log("Creating new timer interval that continues from elapsed time:", elapsedTime);
       
        const newInterval = setInterval(() => {
          setElapsedTime(prevTime => {
            const newTime = prevTime + 1;
            const totalSessionSeconds = sessionDuration * 60;
            
            
            setTimeLeft(Math.max(0, totalSessionSeconds - newTime));
            
           
            if (newTime >= totalSessionSeconds) {
              console.log("Session complete");
              clearInterval(newInterval);
              setTimer(null);
              return totalSessionSeconds;
            }
           
            if (!isBreak && breakInterval > 0 && newTime % (breakInterval * 60) === 0) {
              console.log("Break interval reached");
              clearInterval(newInterval);
              setTimer(null);
            setIsBreak(true);
              setShowBreakNotification(true);
             
              const breakTimeSeconds = (breakDuration * 60) + parseInt(breakDurationSeconds || 0);
              setTimeLeft(breakTimeSeconds);
              
              playSound('/notification.mp3');
            }
            
            return newTime;
          });
        }, 1000);
        
        setTimer(newInterval);
      }
      
      if (faceDetectionEnabled) {
        setFaceDetectionEnabled(false);
        setTimeout(() => setFaceDetectionEnabled(true), 200);
      }
    }, 300);
  };

  const handleExitAnyway = () => {
    
    const currentSession = {
      sessionDuration,
      elapsedTime,
      breakInterval,
      breakDuration,
      isPaused,
      timeLeft,
      pdfFile: pdfFile ? true : false 
    };
    
    console.log("Saving session state before exit:", elapsedTime, timeLeft);
   
    if (typeof window !== 'undefined') {
      localStorage.setItem('sugar-saved-session', JSON.stringify(currentSession));
    }
    
   
    setShowExitConfirmation(false);
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.log("Error exiting fullscreen:", err);
      }).finally(() => {
        
        window.location.href = '/';
      });
    } else {
      
      window.location.href = '/';
    }
  };

  const handleExitStudy = () => {
    setShowExitConfirmation(true);
    setIsPaused(true);
  };

  const handleNewStudySession = () => {
    if (timer) {
      clearInterval(timer);
    }
    setPdfFile(null);
    setIsPaused(false);
    setShowPauseDialog(false);
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  
  const handleFaceStatus = useCallback((isPresent) => {
    
    if (isPresent !== prevFaceStatusRef.current || window.__faceAutoDetectionPause) {
      console.log(`Face detection: Face ${isPresent ? 'DETECTED' : 'ABSENT'}`);
    }
    
    prevFaceStatusRef.current = isPresent;
    
    
    setFacePresent(isPresent);
    
    if (isPaused && !window.__faceAutoDetectionPause) {
      console.log("Timer already manually paused - not changing state");
      return;
    }
    
    if (faceTimeoutRef.current) {
      clearTimeout(faceTimeoutRef.current);
      faceTimeoutRef.current = null;
    }
   
    if (!isPresent && !isPaused && isFullscreen) {
      console.log("Face absent - starting 3-second countdown to pause timer");
      
      faceTimeoutRef.current = setTimeout(() => {
        console.log("Face still absent after 3 seconds - pausing timer");
       
        if (typeof window !== 'undefined') {
          window.__faceAutoDetectionPause = true;
        }
       
        setIsPaused(true);
        setShowFaceAlert(true);
        setAlertMessage("Timer paused - no face detected");

      
        if (soundEnabled) {
          pauseSoundRef.current?.play().catch(err => console.log("Error playing sound:", err));
        }
        
        faceTimeoutRef.current = null;
      }, 3000);
    }
    
    
    if (isPresent && isPaused && window.__faceAutoDetectionPause && isFullscreen) {
      console.log("Face detected again after auto-pause - showing resume option");
      
      setShowFaceAlert(true);
      setAlertMessage("Face detected - resume timer?");
      
     
      if (soundEnabled) {
        resumeSoundRef.current?.play().catch(err => console.log("Error playing sound:", err));
      }
    }
  }, [isPaused, isFullscreen, soundEnabled, setAlertMessage, setShowFaceAlert, setIsPaused]);

  const handleResumeTimer = () => {
    console.log("▶️ User clicked Resume Timer - continuing timer");
   
    setShowFaceAlert(false);
    
    if (typeof window !== 'undefined') {
      window.__faceAutoDetectionPause = false;
    }
   
    setTimeout(() => {
      if (!timer) {
        console.log("Creating new timer interval");
      
        const newInterval = setInterval(() => {
          setElapsedTime(prevTime => {
            const newTime = prevTime + 1;
            const totalSessionSeconds = sessionDuration * 60;
           
            if (newTime >= totalSessionSeconds) {
              console.log("Session complete");
              clearInterval(newInterval);
              setTimer(null);
              return totalSessionSeconds; 
            }
            
          
            if (!isBreak && breakInterval > 0 && newTime % (breakInterval * 60) === 0) {
              clearInterval(newInterval);
              setTimer(null);
              setIsBreak(true);
              setShowBreakNotification(true);
              playSound('/notification.mp3');
            }
            
            return newTime;
          });
        }, 1000);
        
        setTimer(newInterval);
      }
     
      setIsPaused(false);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (timer) {
        clearInterval(timer);
      }
      if (faceTimeoutRef.current) {
        clearTimeout(faceTimeoutRef.current);
        faceTimeoutRef.current = null;
      }
    };
  }, [timer]);


  useEffect(() => {

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [pdfFile, isPaused, timer, isFullscreen, faceDetectionEnabled]);

 
  useEffect(() => {
   
    if (facePresent && window.__faceAutoDetectionPause && isPaused && !showFaceAlert) {
      console.log("Detected face presence during auto-pause but alert not showing - fixing");
      setShowFaceAlert(true);
    }
    
    if (!facePresent && showFaceAlert && window.__faceAutoDetectionPause) {
      console.log("Face not present but resume button showing - updating UI");
      
      setAlertMessage("Timer paused - no face detected");
    }
  }, [facePresent, isPaused, showFaceAlert, setAlertMessage]);

  const AlertComponent = ({ show, message, onClose }) => {
    if (!show) return null;
    
    const handleResume = () => {
      
      if (typeof window !== 'undefined') {
        window.__faceAutoDetectionPause = false;
      }
      
      handleResumeTimer();
      
     
      onClose();
    };
    
    return (
      <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center z-50 bg-black bg-opacity-50 transition-opacity duration-300">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Study Timer</h3>
          <p className="mb-6 text-gray-600">{message}</p>
          <div className="flex justify-end space-x-3">
            {window.__faceAutoDetectionPause && (
              <button 
                onClick={handleResume} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Resume Timer
              </button>
            )}
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getRemainingTime = () => {
    const totalSessionSeconds = sessionDuration * 60;
    const remainingSeconds = Math.max(0, totalSessionSeconds - elapsedTime);
    return remainingSeconds;
  };

  const troubleshootFullscreenAndCamera = () => {
    console.log("Troubleshooting fullscreen and camera...");
    
  
    const isDocumentFullscreen = !!document.fullscreenElement || 
                               !!document.mozFullScreenElement ||
                               !!document.webkitFullscreenElement || 
                               !!document.msFullscreenElement;
                               
    console.log("Current fullscreen state:", isDocumentFullscreen);
    
    if (isDocumentFullscreen !== isFullscreen) {
      console.log("Fixing fullscreen state mismatch");
      setIsFullscreen(isDocumentFullscreen);
    }
    

    if (isDocumentFullscreen && faceDetectionEnabled) {
      console.log("Reactivating face detection");
      setFaceDetectionEnabled(false);
      setTimeout(() => setFaceDetectionEnabled(true), 200);
    }
  };

  const enterFullscreenManually = () => {
    console.log("Attempting to enter fullscreen mode manually");
    
    try {
      const docElement = document.documentElement;
      if (docElement.requestFullscreen) {
        docElement.requestFullscreen()
          .then(() => {
            console.log("Fullscreen activated successfully");
            setIsFullscreen(true);
          })
          .catch(err => {
            console.error("Fullscreen permission denied:", err);
            alert("Could not enter fullscreen mode. Please use the study features without fullscreen.");
            setIsFullscreen(false);
          });
      } else if (docElement.mozRequestFullScreen) {
        docElement.mozRequestFullScreen()
          .catch(err => {
            console.error("Fullscreen error:", err);
            setIsFullscreen(false);
          });
      } else if (docElement.webkitRequestFullscreen) {
        docElement.webkitRequestFullscreen()
          .catch(err => {
            console.error("Fullscreen error:", err);
            setIsFullscreen(false);
          });
      } else if (docElement.msRequestFullscreen) {
        docElement.msRequestFullscreen()
          .catch(err => {
            console.error("Fullscreen error:", err);
            setIsFullscreen(false);
          });
      } else {
        console.log("No fullscreen API available");
        alert("Your browser doesn't support fullscreen mode. You can still use all features.");
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Error requesting fullscreen:", err);
      alert("Could not enter fullscreen mode. You can still use the study features without fullscreen.");
      setIsFullscreen(false);
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      console.log("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Stop the stream immediately since we just need permission
      stream.getTracks().forEach(track => track.stop());
      
      console.log("Camera permission granted");
      setCameraPermissionGranted(true);
      return true;
    } catch (error) {
      console.error("Camera permission denied:", error);
      alert("Camera access was denied. Face detection requires camera permissions.");
      return false;
    }
  };

  const resumeFromBreak = () => {
    console.log("Resuming from break...");
    
    setIsBreak(false);
    setShowBreakNotification(false);
    
   
    const isCurrentlyFullscreen = !!document.fullscreenElement || 
                               !!document.mozFullScreenElement ||
                               !!document.webkitFullscreenElement || 
                               !!document.msFullscreenElement;
                               
    if (!isCurrentlyFullscreen) {
      console.log("Requesting fullscreen on break resume");
      setTimeout(() => {
        try {
          const docElement = document.documentElement;
          if (docElement.requestFullscreen) {
            docElement.requestFullscreen()
              .then(() => {
                console.log("Successfully entered fullscreen on resume");
                setIsFullscreen(true);
              })
              .catch(err => {
                console.error("Error entering fullscreen:", err);
                alert("Couldn't enter fullscreen mode. You can continue studying in windowed mode.");
              });
          } else if (docElement.mozRequestFullScreen) {
            docElement.mozRequestFullScreen();
            setIsFullscreen(true);
          } else if (docElement.webkitRequestFullscreen) {
            docElement.webkitRequestFullscreen();
            setIsFullscreen(true);
          } else if (docElement.msRequestFullscreen) {
            docElement.msRequestFullscreen();
            setIsFullscreen(true);
          }
        } catch (err) {
          console.error("Error requesting fullscreen:", err);
        }
      }, 100);
    }
  
    setTimeout(() => {
      if (isPaused) {
      setIsPaused(false);
    }
    
      if (!timer) {
        startTimer();
      }
     
      if (faceDetectionEnabled) {
       
        setFaceDetectionEnabled(false);
        setTimeout(() => setFaceDetectionEnabled(true), 200);
      }
    }, 300);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f0e6ef] text-gray-800 items-center p-4">
      <header className="w-full max-w-7xl flex justify-between items-center mb-8">
        {/* Removed the back arrow completely */}
        
        <h1 className="text-3xl font-bold">Virtual Study Room</h1>
        
        <div className="flex items-center space-x-2">
          {pdfFile && (
            <button 
              onClick={handleExitStudy}
              className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition-colors"
              title="Exit Study Session"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* Fullscreen troubleshooting button */}
      {pdfFile && (
        <div className="fixed bottom-4 right-4 z-50">
          <button 
            onClick={troubleshootFullscreenAndCamera}
            className="bg-gray-800 text-white text-xs px-3 py-1 rounded-full opacity-70 hover:opacity-100"
            title="Fix Camera Issues"
          >
            📷 Fix
          </button>
        </div>
      )}

      {/* Face Detection Component - works in both regular and fullscreen modes as long as camera permissions are given */}
      {pdfFile && faceDetectionEnabled && (
        <div className="fixed top-0 right-0 z-[1000]">
          <FaceDetection 
            onFaceStatus={handleFaceStatus}
            isFullscreen={true} 
            isPaused={isPaused}
          />
        </div>
      )}

      {/* Face detection status indicator */}
      {pdfFile && faceDetectionEnabled && (
        <div className="fixed top-4 right-4 bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full z-50">
          <div className="flex items-center">
            <span 
              className={`inline-block h-2 w-2 rounded-full mr-2 ${facePresent ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            ></span>
            <span>{facePresent ? 'Face Detected' : 'No Face'}</span>
          </div>
        </div>
      )}

      {!pdfFile ? (
        <div className="w-full max-w-3xl">
          <div 
            className="drop-area border-2 border-dashed border-pink-300 rounded-xl w-full p-10 text-center mb-8 transition-colors hover:border-pink-400 bg-white bg-opacity-60"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400 mb-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <line x1="10" y1="9" x2="8" y2="9"></line>
              </svg>
            <h2 className="text-2xl font-semibold mb-2">Drag & Drop Your Study Material Here</h2>
              <p className="mb-4 text-gray-600">(Screen will go fullscreen & timer will start)</p>
              <p className="mb-6 text-sm text-gray-500">Face detection will automatically pause your timer when you're away</p>
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              id="fileInput"
              onChange={(e) => handleFiles(e.target.files)} 
            />
            <label 
              htmlFor="fileInput" 
                className="bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-lg cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg text-lg"
            >
              Select PDF File
            </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow-md">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Study Session Duration
              </label>
              <div className="flex items-center">
                <div className="flex-1 mr-2">
                  <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
                  <input 
                    type="number" 
                    min="0"
                    max="720"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                    value={sessionDuration}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(720, parseInt(e.target.value) || 0));
                      setSessionDuration(value);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Seconds</label>
                  <input 
                    type="number" 
                    min="0"
                    max="59"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                    value={sessionDurationSeconds}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setSessionDurationSeconds(value);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow-md">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Break Interval
              </label>
              <div className="flex items-center">
                <div className="flex-1 mr-2">
                  <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
                  <input 
                    type="number" 
                    min="0"
                    max="720"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                    value={breakInterval}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(720, parseInt(e.target.value) || 0));
                      setBreakInterval(value);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Seconds</label>
                  <input 
                    type="number" 
                    min="0"
                    max="59"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                    value={breakIntervalSeconds}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setBreakIntervalSeconds(value);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow-md">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Break Duration
              </label>
              <div className="flex items-center">
                <div className="flex-1 mr-2">
                  <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
                  <input 
                    type="number" 
                    min="0"
                    max="720"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                    value={breakDuration}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(720, parseInt(e.target.value) || 0));
                      setBreakDuration(value);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Seconds</label>
                  <input 
                    type="number" 
                    min="0"
                    max="59"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                    value={breakDurationSeconds}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setBreakDurationSeconds(value);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Face detection settings */}
          <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow-md mb-8">
            <h3 className="text-lg font-semibold mb-2">Face Detection Settings</h3>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="faceDetection"
                checked={faceDetectionEnabled}
                onChange={(e) => setFaceDetectionEnabled(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
              />
              <label htmlFor="faceDetection" className="text-sm">
                Enable face detection (pauses timer when you're away)
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This feature uses your camera to detect if you're present and automatically pauses your timer when you step away during study.
            </p>
          </div>

          <div className="bg-white bg-opacity-90 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Study Room Features</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">🔍</span>
                <span>Upload and read PDF study materials with built-in viewer</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">⏱️</span>
                <span>Customizable study timers with automatic break reminders</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">🧘‍♀️</span>
                <span>Guided breathing exercises during breaks to help you relax</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">🔒</span>
                <span>Fullscreen mode to minimize distractions</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">📝</span>
                <span>Take and save notes while you study</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">🎵</span>
                <span>Background music options to improve focus</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">👤</span>
                <span>Face detection to pause timer when you step away</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">🔍</span>
                <span>Zoom and rotate controls for better reading experience</span>
              </li>
              <li className="flex items-start">
                <span className="text-pink-500 mr-2">⌨️</span>
                <span>Keyboard shortcuts for faster navigation</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Centered timer display */}
          <div className="w-full text-center mb-6">
            <div className="inline-flex items-center">
              <h2 className="text-3xl font-bold mr-3">Study Time</h2>
              <span className="text-3xl font-bold text-pink-500">
                {formatTimeDisplay(getRemainingTime())}
              </span>
            </div>
          </div>
          
        <div className={`w-full flex ${showNotes ? 'flex-row' : 'flex-col'} items-center relative`}>
          <div className={`${showNotes ? 'w-3/4 pr-4' : 'w-full'} flex flex-col items-center`}>
            <div className={`flex justify-between items-center w-full max-w-4xl mb-4 ${!showToolbar ? 'opacity-0 hover:opacity-100 transition-opacity duration-300' : ''}`}>
                <div className="flex-1"></div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={toggleFocusMode} 
                  className="bg-purple-100 text-purple-700 p-2 rounded-lg hover:bg-purple-200 transition-colors"
                  title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
                >
                  {focusMode ? "🔍" : "👁️"}
                </button>
                  
                  <button 
                    onClick={() => setShowSummarizer(true)} 
                    className="bg-yellow-100 text-yellow-700 p-2 rounded-lg hover:bg-yellow-200 transition-colors"
                    title="Open Notes Summarizer"
                  >
                    📋
                  </button>
                  
                  <button 
                    onClick={() => setShowAI(true)} 
                    className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Ask SUGAI AI"
                  >
                    🤖
                  </button>
                
                <button 
                  onClick={toggleNotes} 
                  className={`p-2 rounded-lg transition-colors ${showNotes ? 'bg-green-200 text-green-700' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  title="Toggle Notes Panel"
                >
                  📝
                </button>
                
                <button 
                  onClick={toggleMusic} 
                  className={`p-2 rounded-lg transition-colors ${playingMusic ? 'bg-blue-200 text-blue-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                  title={playingMusic ? "Pause Music" : "Play Music"}
                >
                  {playingMusic ? "🔇" : "🎵"}
                </button>
              </div>
            </div>
            
            {/* Music selector */}
            {playingMusic && showToolbar && (
              <div className="flex justify-center w-full max-w-4xl mb-4">
                <div className="bg-blue-50 p-2 rounded-lg flex space-x-2">
                  {Object.entries(musicOptions).map(([type, url]) => (
                    <button 
                      key={type}
                      onClick={() => changeMusic(type)}
                      className={`px-3 py-1 rounded ${selectedMusicType === type ? 'bg-blue-500 text-white' : 'bg-blue-100 hover:bg-blue-200'}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className={`w-full max-w-4xl bg-white p-4 rounded-lg shadow-lg relative ${focusMode ? 'shadow-2xl ring-4 ring-purple-200' : ''}`}>
              <div className={`flex justify-between items-center mb-2 ${!showToolbar ? 'opacity-0 hover:opacity-100 transition-opacity duration-300' : ''}`}>
                <div className="flex space-x-2">
                  <button 
                    onClick={goToPreviousPage} 
                    disabled={currentPage <= 1}
                    className="bg-pink-100 text-pink-700 p-2 rounded-lg disabled:opacity-50 hover:bg-pink-200 transition-colors"
                  >
                    ❮ Previous
                  </button>
                  <div className="bg-gray-100 px-3 py-2 rounded-lg">
                    Page {currentPage} of {numPages || '--'} {pagesRead > 0 && `(${Math.round((pagesRead / studyGoal) * 100)}% of goal)`}
                  </div>
                  <button 
                    onClick={goToNextPage} 
                    disabled={currentPage >= numPages}
                    className="bg-pink-100 text-pink-700 p-2 rounded-lg disabled:opacity-50 hover:bg-pink-200 transition-colors"
                  >
                    Next ❯
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={handleZoomOut}
                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                    title="Zoom Out"
                  >
                    🔍-
                  </button>
                  <div className="bg-gray-100 px-3 py-2 rounded-lg">
                    {Math.round(zoomLevel * 100)}%
                  </div>
                  <button 
                    onClick={handleZoomIn}
                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                    title="Zoom In"
                  >
                    🔍+
                  </button>
                  <button 
                    onClick={handleRotate}
                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                    title="Rotate"
                  >
                    🔄
                  </button>
                </div>
              </div>
              
              <div className={`flex justify-center overflow-auto max-h-[calc(100vh-300px)] ${rotation === 90 || rotation === 270 ? 'items-start' : 'items-center'}`}>
                  <div className="relative">
                <canvas ref={canvasRef} className="max-w-full"></canvas>
                    <div ref={textLayerRef} className="textLayer"></div>
                    
                    {/* Text selection hint - make it less intrusive */}
                    <div className="absolute top-2 left-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs opacity-30 hover:opacity-80 transition-opacity">
                      💡 Select text to summarize
                    </div>
                  </div>
              </div>
              
              {tabSwitches > 0 && (
                <div className="absolute top-2 right-2 bg-red-100 text-red-800 px-3 py-1 rounded-lg text-sm">
                  Tab switches: {tabSwitches} 🤔
                </div>
              )}
            </div>
          </div>
          
          {/* Notes Panel */}
          {showNotes && (
            <div className="w-1/4 bg-white rounded-lg shadow-lg p-4 ml-4 h-[calc(100vh-220px)] flex flex-col">
              <h3 className="text-xl font-semibold mb-2">Notes</h3>
              <div className="flex-1 overflow-auto mb-4">
                {notes.length > 0 ? (
                  <div className="space-y-3">
                    {notes.map(note => (
                      <div key={note.id} className="bg-yellow-50 p-3 rounded shadow">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Page {note.page}</span>
                          <span>{note.timestamp}</span>
                        </div>
                        <p className="text-sm mb-2">{note.text}</p>
                        <button 
                          onClick={() => deleteNote(note.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No notes yet. Add notes about what you're studying!</p>
                )}
              </div>
              <div className="mt-auto">
                <textarea
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-300 focus:outline-none min-h-[100px] text-sm"
                  placeholder="Take notes here..."
                ></textarea>
                <button
                  onClick={addNote}
                  disabled={!currentNote.trim()}
                  className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg w-full disabled:opacity-50 transition-colors"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>
          
          {/* Face detection alert dialog */}
          {showFaceAlert && (
            <AlertComponent 
              show={showFaceAlert}
              message={alertMessage}
              onClose={() => setShowFaceAlert(false)}
            />
          )}
        </>
      )}
      
      {/* Exit Confirmation Dialog */}
      {showExitConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold text-red-600 mb-6">Study Session in Progress</h2>
            <p className="text-xl text-gray-700 mb-8">Your study session is not finished yet.</p>
            
            <div className="bg-gray-100 p-6 rounded-lg mb-6">
              <p className="text-xl font-semibold">Time remaining: <span className="text-red-500 font-bold">{formatTimeHMS(timeLeft)}</span></p>
            </div>
            
            <div className="flex justify-center gap-4">
              <button 
                onClick={handleExitAnyway}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition-colors"
              >
                Exit Anyway
              </button>
              <button 
                onClick={handleContinueStudying}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition-colors"
              >
                Continue Studying
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Study Session Paused Dialog */}
      {showPauseDialog && !showExitConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-90">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Study Session Paused</h2>
            
            <p className="text-xl text-gray-700 mb-10">
              You have <span className="text-pink-500 font-bold">{formatTimeDisplay(timeLeft)}</span> remaining in your study session.
            </p>
            
            <div className="flex justify-center space-x-4">
              <button 
                onClick={handleContinueStudying}
                className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-4 px-6 rounded-full text-lg transition-colors w-1/2"
              >
                Continue Studying
              </button>
              <button 
                onClick={handleExitAnyway}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-4 px-6 rounded-full text-lg transition-colors w-1/2"
              >
                Exit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Break Time Notification */}
      {showBreakNotification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold text-blue-500 mb-2">Break Time!</h2>
            <p className="text-gray-700 text-lg mb-6">
              Time to take a short break and refresh your mind.
            </p>
            
            <div className="bg-gray-100 p-6 rounded-lg mb-6">
              <p className="text-xl font-semibold">Break time remaining: <span className="text-blue-500 font-bold">{formatTimeDisplay(timeLeft)}</span></p>
              
              {/* Progress bar for break timer */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeLeft / ((breakDuration * 60) + parseInt(breakDurationSeconds || 0))) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <button 
              onClick={resumeFromBreak}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors"
            >
              Continue
            </button>
            
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-2">During your break:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Look away from your screen</li>
                <li>• Stretch your body</li>
                <li>• Drink some water</li>
                <li>• Rest your eyes</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab switching warning */}
      {tabSwitches > 0 && !isBreak && (
        <div className={`fixed bottom-4 right-4 bg-red-100 text-red-800 p-3 rounded-lg shadow-lg max-w-xs transition-opacity ${showToolbar ? 'opacity-100' : 'opacity-0'}`}>
          <p className="font-semibold">Distraction Alert!</p>
          <p className="text-sm">You've switched tabs {tabSwitches} times during this study session.</p>
          <p className="text-xs mt-1">Try to stay focused on your studies.</p>
        </div>
      )}

      {/* Progress indicator */}
      {pdfFile && (
        <div className={`fixed bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg transition-opacity ${showToolbar ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center mb-1">
            <span className="text-sm font-medium mr-2">Study Goal:</span>
            <input
              type="number"
              min="1"
              max={numPages || 100}
              value={studyGoal}
              onChange={(e) => setStudyGoal(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <span className="text-sm ml-1">pages</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-green-400 to-blue-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (pagesRead / studyGoal) * 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {pagesRead} of {studyGoal} pages ({Math.round((pagesRead / studyGoal) * 100)}%)
          </p>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      {pdfFile && (
        <button 
          className={`fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full transition-opacity ${showToolbar ? 'opacity-100' : 'opacity-0'} ${showNotes ? 'right-[calc(25%+1rem)]' : ''} ${tabSwitches > 0 ? 'bottom-24' : ''}`}
          onClick={() => alert("Keyboard Shortcuts:\n\n→ Next Page\n← Previous Page\n+ Zoom In\n- Zoom Out\nr Rotate\nf Toggle Focus Mode\nm Toggle Music\nn Toggle Notes Panel")}
          title="Keyboard Shortcuts"
        >
          ⌨️
        </button>
      )}

      {/* Recovery Dialog */}
      {showRecoveryDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Restore Study Session</h2>
            
            <p className="text-xl text-gray-700 mb-8">
              Would you like to restore your previous study session?
            </p>
            
            <div className="flex justify-center gap-4">
              <button 
                onClick={restoreSavedSession}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition-colors"
              >
                Restore
              </button>
              <button 
                onClick={startNewSession}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition-colors"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUGAI AI chatbot */}
      {showAI && <SugaiAI onClose={() => setShowAI(false)} />}

      {/* Notes Summarizer */}
      {showSummarizer && <NoteSummarizer onClose={() => setShowSummarizer(false)} />}

      {faceDetectionEnabled && !pdfFile && (
        <div className="mt-4 text-center">
          <p className="text-gray-600 mb-2">
            Face detection will start automatically when you upload a PDF.
          </p>
        </div>
      )}

      {/* Face Detection component - render when PDF is loaded and face detection is enabled */}
      {pdfFile && faceDetectionEnabled && (
        <FaceDetection
          onFaceStatus={handleFaceStatus}
          isPaused={isPaused}
          isFullscreen={isFullscreen}
        />
      )}

      <style jsx>{`
        .breathing-circle {
          transition: transform 4s ease-in-out, background-color 4s ease-in-out;
        }
        
        @keyframes breathe {
          0%, 100% { transform: scale(1); background-color: rgb(96, 165, 250); }
          50% { transform: scale(1.5); background-color: rgb(74, 222, 128); }
        }
        
        .drop-area {
          transition: border-color 0.2s ease;
          border-width: 2px;
          border-style: dashed;
        }
      `}</style>
    </main>
  );
}
