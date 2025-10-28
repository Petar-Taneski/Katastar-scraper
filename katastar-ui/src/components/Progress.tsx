"use client";

const formatTime = (ms: number) => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((ms % 1000) / 100); // tenths of a second

  const pad = (num: number) => num.toString().padStart(2, '0');

  return `${pad(minutes)}:${pad(seconds)}.${milliseconds}`;
};

// --- Updated Props Type ---
type Props = {
  isLoading: boolean;
  elapsedTime: number; 
  isFinished: boolean; 
  isStopped: boolean; // Added for cancellation tracking
};

// --- Updated Component ---
export default function Progress({ isLoading, elapsedTime, isFinished, isStopped }: Props) {
  
  // 1a. If the process was explicitly stopped by the user
  if (isStopped) {
      return (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
              <p className="font-medium">
                  🛑 Процесот беше прекинат.
              </p>
          </div>
      );
  }

  // 1b. if not loading and finished (success case)
  if (!isLoading && isFinished) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <p className="font-medium">
          ✅ Завршено! Искористено време: <b>{formatTime(elapsedTime)}</b>
        </p>
      </div>
    );
  }

  // 2. if loading, show the live progress with the timer
if (isLoading) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 animate-ping rounded-full bg-indigo-500"></span>
            <p className="font-medium">Ве молиме почекајте...</p>
          </div>
          <p className="font-mono text-sm font-semibold">
            {formatTime(elapsedTime)}
          </p>
        </div>
      </div>
    );
  }

  // 3. if neither loading nor finished (initial state), show nothing
  return null;
}
