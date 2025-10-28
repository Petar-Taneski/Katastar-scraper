"use client";

import { useRef, useState } from "react";
import JobRow from "@/components/JobRow";

import Progress from "@/components/Progress";
import { JobInput } from "@/lib/types";
import { postScrape } from "@/lib/api";
import axios from "axios";

export default function Page() {
  const [jobs, setJobs] = useState<JobInput[]>([
    { region: "", katastar_region: "", parcel: "" },
  ]);
  const [isLoading, setLoading] = useState(false);
  const [current, setCurrent] = useState<JobInput | undefined>(); 
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("results.xlsx");

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const [isStopped, setIsStopped] = useState(false); // Tracks if the user manually stopped the process
  const abortControllerRef = useRef<AbortController | null>(null); // Reference to the controller used for cancellation 

  // timer functions
  const startTimer = () => {
    setIsFinished(false);
    setElapsedTime(0);
    // clear any existing interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    // store the start time
    const startTime = Date.now();
    // start a new interval to update time every 100ms
    intervalRef.current = window.setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
  };

  const stopTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsFinished(true);
  };

  const addJob = () =>
    setJobs((prev) => [...prev, { region: "", katastar_region: "", parcel: "" }]);

  const removeJob = (idx: number) =>
    setJobs((prev) => prev.filter((_, i) => i !== idx));

  const updateJob = (idx: number, field: keyof JobInput, v: string) =>
    setJobs((prev) =>
      prev.map((j, i) => (i === idx ? { ...j, [field]: v } : j))
    );

  const handleStop = () => {
    if (abortControllerRef.current) {
        // This triggers the cancellation error in the try/catch block of handleSubmit
        abortControllerRef.current.abort(); 
        abortControllerRef.current = null;
    }
    // Immediately update UI states
    setLoading(false);
    stopTimer();
    setIsStopped(true); // Indicate the process was interrupted
    setDownloadUrl(null); // Clear any partial/old download link
};
  

  const handleSubmit = async () => {
    // Reset any previous stop/download state
    setIsStopped(false);
    setDownloadUrl(null);

    // Basic validation
    const cleanJobs = jobs
      .map(({ region, katastar_region, parcel }) => ({
        region: region.trim(),
        parcel: parcel.trim(),
        katastar_region: katastar_region?.trim() || undefined,
      }))
      .filter((j) => j.region && j.parcel);

    if (cleanJobs.length === 0) {
      alert("Please fill at least one row with Region and Parcel.");
      return;
    }

    setLoading(true);
    startTimer(); 

    // --- ABORT LOGIC: Create and store the controller ---
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      // Pass the signal to the API call so it can be canceled
      const res = await postScrape({ jobs: cleanJobs }, controller.signal);
      
      // If successful, clean up the controller ref
      abortControllerRef.current = null; 

      setFilename(res.filename || "results.xlsx");

      // Make a temporary download link
      const blob = b64ToBlob(res.file_b64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err: any) {
      console.error(err);
      
      // Check if the error is due to user cancellation (Axios error code)
      if (axios.isCancel(err) || err.name === 'AbortError') {
         // handleStop already cleaned up the state. Just exit.
         return; 
      }
      
      // For all other errors
      alert(err?.response?.data?.detail || "Scrape failed.");
      setIsStopped(false); // Ensure stop message doesn't display on error

    } finally {
      // Ensure loading state and timer are always cleaned up
      setLoading(false);
      stopTimer();
      abortControllerRef.current = null;
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">

        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-black">Пребарување на листа од парцели</h1>
        <p className="text-black">
          Додадете колку што сакате редови (регион, катастарски оддел (опционално), парцела). Резултатите ќе бидат вратени како еден Excel фајл.
        </p>

        <div className="space-y-3">
          {jobs.map((j, i) => (
            <JobRow
              key={i}
              idx={i}
              value={j}
              onChange={updateJob}
              onRemove={removeJob}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">

  {isLoading ? (
    // 🛑 If isLoading is TRUE: Render the STOP button
    <button
      type="button"
      className="rounded-2xl bg-red-600 text-white px-5 py-2 hover:bg-red-700 transition"
      onClick={handleStop} // ⬅️ Calls the stop function
    >
      СТОП
    </button>
  ) : (
    // ▶️ If isLoading is FALSE: Render the original SUBMIT button
    <button
      type="button"
      className="rounded-2xl bg-indigo-600 text-white px-5 py-2 hover:bg-indigo-700 transition"
      onClick={handleSubmit}
    >
      Пребарај
    </button>
  )}
  {/* The Add Row button and Download link follow here... */}
          <button
            type="button"
            className="rounded-2xl border border-zinc-300 px-5 py-2 hover:bg-zinc-100 transition text-black"
            onClick={addJob}
            disabled={isLoading}
          >
            + Додади редица
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={filename}
              className="ml-auto rounded-2xl border border-emerald-300 text-emerald-700 px-5 py-2 hover:bg-emerald-50 transition"
            >
              Преземи {filename}
            </a>
          )}
        </div>

     <Progress 
          isLoading={isLoading} 
          elapsedTime={elapsedTime} 
          isFinished={isFinished} 
          isStopped={isStopped}
        />
      </section>
    </main>
  );
}

function b64ToBlob(b64Data: string, contentType = "", sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length).fill(0).map((_, i) => slice.charCodeAt(i));
    const byteArray = new Uint8Array(byteNumbers);
    // push the underlying ArrayBuffer so the Blob constructor receives ArrayBuffer parts
    byteArrays.push(byteArray.buffer);
  }

  return new Blob(byteArrays, { type: contentType });
  
}
