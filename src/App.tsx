import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import QRCode from 'react-qr-code';
import { Camera, Download, History, CheckCircle, XCircle, Loader2, Lock, Delete, ChevronLeft, QrCode, ShieldCheck } from 'lucide-react';
import { analyzeIdImage, ScanResult } from './lib/gemini';
import { playSuccessSound, playFailureSound } from './lib/audio';

interface HistoryItem extends ScanResult {
  id: string;
  timestamp: string;
  age: number;
  is18Plus: boolean;
}

function calculateAge(dobString: string): { age: number; is18Plus: boolean } {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return { age, is18Plus: age >= 18 };
}

function exportToCSV(history: HistoryItem[]) {
  const headers = ['Timestamp', 'Document Type', 'Initials', 'DOB', 'Age', 'Gender', 'Status'];
  const rows = history.map(item => [
    item.timestamp,
    `"${item.documentType}"`,
    `"${item.initials}"`,
    item.dob,
    item.age.toString(),
    item.gender,
    item.is18Plus ? '18+' : 'Under 18'
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `scan_history_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function App() {
  const [view, setView] = useState<'pin' | 'home' | 'scanner' | 'share'>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setPinError(false);
      if (newPin.length === 4) {
        if (newPin === '3528') {
          setTimeout(() => {
            setView('home');
            setPin('');
          }, 200);
        } else {
          setPinError(true);
          playFailureSound();
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setIsScanning(true);
    setCurrentResult(null);

    try {
      const result = await analyzeIdImage(imageSrc);
      const { age, is18Plus } = calculateAge(result.dob);
      
      const historyItem: HistoryItem = {
        ...result,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleString(),
        age,
        is18Plus
      };

      if (is18Plus) {
        playSuccessSound();
      } else {
        playFailureSound();
      }

      setCurrentResult(historyItem);
      setHistory(prev => [historyItem, ...prev]);
      
      setTimeout(() => {
        setCurrentResult(null);
      }, 5000);
      
    } catch (error) {
      console.error("Scanning failed", error);
      alert("Failed to scan ID. Please try again and ensure the ID is clearly visible.");
    } finally {
      setIsScanning(false);
    }
  }, [webcamRef]);

  const renderHistory = () => (
    <div className="absolute inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
      <div className="relative w-full max-w-md bg-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-xl font-bold">Scan History</h2>
          <button 
            onClick={() => exportToCSV(history)}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-zinc-500 text-center mt-10">No scans recorded yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700/50">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${item.is18Plus ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {item.is18Plus ? '18+' : 'UNDER 18'}
                  </span>
                  <span className="text-xs text-zinc-500">{item.timestamp}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-zinc-500">Age:</span> {item.age}</div>
                  <div><span className="text-zinc-500">Initials:</span> {item.initials}</div>
                  <div><span className="text-zinc-500">DOB:</span> {item.dob}</div>
                  <div><span className="text-zinc-500">Gender:</span> {item.gender}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (view === 'pin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-4 font-sans">
        <ShieldCheck className="w-16 h-16 mb-6 text-blue-500" />
        <h2 className="text-2xl font-bold mb-2">Age Verifier</h2>
        <p className="text-zinc-400 mb-8">Enter PIN to access</p>
        
        <div className={`flex gap-6 mb-12 ${pinError ? 'animate-bounce text-red-500' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${pin.length > i ? (pinError ? 'bg-red-500' : 'bg-white') : 'bg-zinc-800'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handlePinPress(num.toString())} className="h-16 bg-zinc-900 rounded-2xl text-2xl font-medium hover:bg-zinc-800 active:bg-zinc-700 transition-colors">
              {num}
            </button>
          ))}
          <div />
          <button onClick={() => handlePinPress('0')} className="h-16 bg-zinc-900 rounded-2xl text-2xl font-medium hover:bg-zinc-800 active:bg-zinc-700 transition-colors">0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} className="h-16 bg-zinc-900 rounded-2xl text-xl font-medium hover:bg-zinc-800 active:bg-zinc-700 transition-colors flex items-center justify-center">
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  if (view === 'share') {
    const shareUrl = window.location.href;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans relative">
        <button onClick={() => setView('home')} className="absolute top-6 left-6 p-3 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <QrCode className="w-12 h-12 mb-6 text-blue-500" />
        <h2 className="text-3xl font-bold mb-2">Share App</h2>
        <p className="text-zinc-400 mb-10 text-center max-w-xs">Scan this QR code with another device to open the Age Verifier.</p>
        
        <div className="bg-white p-6 rounded-3xl shadow-2xl">
          <QRCode value={shareUrl} size={220} />
        </div>
        
        <p className="mt-8 text-sm text-zinc-500 font-mono bg-zinc-900 px-4 py-2 rounded-lg break-all text-center max-w-xs">
          {shareUrl}
        </p>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
        <header className="p-6 pt-12 pb-8 flex flex-col items-center border-b border-zinc-900">
          <ShieldCheck className="w-12 h-12 text-blue-500 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight">NZ Age Verifier</h1>
          <p className="text-zinc-400 mt-2">Staff Access Portal</p>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-4 max-w-md mx-auto w-full">
          <button 
            onClick={() => setView('scanner')} 
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Camera className="w-6 h-6" />
            Start Scanner
          </button>
          
          <button 
            onClick={() => setShowHistory(true)} 
            className="w-full py-5 bg-zinc-900 hover:bg-zinc-800 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 transition-colors border border-zinc-800"
          >
            <History className="w-6 h-6" />
            View History
          </button>
          
          <button 
            onClick={() => setView('share')} 
            className="w-full py-5 bg-zinc-900 hover:bg-zinc-800 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 transition-colors border border-zinc-800"
          >
            <QrCode className="w-6 h-6" />
            Share App
          </button>
        </main>

        <footer className="p-6 text-center">
          <button 
            onClick={() => setView('pin')} 
            className="text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <Lock className="w-4 h-4" />
            Lock App
          </button>
        </footer>

        {showHistory && renderHistory()}
      </div>
    );
  }

  // Scanner View
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans relative overflow-hidden">
      {/* Header */}
      <header className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
        <button 
          onClick={() => setView('home')}
          className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Scanner</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Camera View */}
        <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay Guide */}
          <div className="absolute inset-0 border-4 border-white/20 rounded-2xl pointer-events-none m-8 flex items-center justify-center">
            <div className="w-full h-48 border-2 border-dashed border-white/50 rounded-xl"></div>
          </div>

          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-lg font-medium animate-pulse">Analyzing ID...</p>
            </div>
          )}

          {/* Result Overlay */}
          {currentResult && !isScanning && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-20 p-6 text-center backdrop-blur-md ${
              currentResult.is18Plus ? 'bg-green-900/80' : 'bg-red-900/80'
            }`}>
              {currentResult.is18Plus ? (
                <CheckCircle className="w-32 h-32 text-green-400 mb-6" />
              ) : (
                <XCircle className="w-32 h-32 text-red-400 mb-6" />
              )}
              
              <h2 className="text-5xl font-bold mb-2">
                {currentResult.is18Plus ? '18+' : 'UNDER 18'}
              </h2>
              
              <div className="bg-black/40 rounded-xl p-4 w-full mt-6 text-left space-y-2">
                <p><span className="text-zinc-400">Age:</span> <span className="font-mono text-xl">{currentResult.age}</span></p>
                <p><span className="text-zinc-400">DOB:</span> <span className="font-mono">{currentResult.dob}</span></p>
                <p><span className="text-zinc-400">Initials:</span> <span className="font-mono">{currentResult.initials}</span></p>
                <p><span className="text-zinc-400">Gender:</span> <span className="font-mono">{currentResult.gender}</span></p>
              </div>
              
              <button 
                onClick={() => setCurrentResult(null)}
                className="mt-8 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-full font-medium transition-colors"
              >
                Scan Next
              </button>
            </div>
          )}
        </div>

        {/* Capture Button */}
        <div className="mt-8">
          <button
            onClick={capture}
            disabled={isScanning || !!currentResult}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_0_4px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
