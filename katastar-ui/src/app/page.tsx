"use client";

import { useRef, useState } from "react";
import JobRow from "@/components/JobRow";
import Progress from "@/components/Progress";
import { JobInput } from "@/lib/types";
import { postScrape } from "@/lib/api";
import axios from "axios";

// --- START: Helper Functions (Outside Component) ---

function parseInputText(text: string): JobInput[] {
  const lines = text.split('\n');
  const jobs: JobInput[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    
    const parts = line.split(/[,\t;]/).map(p => p.trim()).filter(p => p.length > 0);
    
    let job: JobInput | null = null;

    if (parts.length === 2) {
      // Format: Region, Parcel
      const [region, parcel] = parts;
      job = { region, parcel, katastar_region: undefined };
    } else if (parts.length >= 3) {
      // Format: Region, KatastarRegion, Parcel (taking only the first three)
      const [region, katastar_region, parcel] = parts;
      job = { region, parcel, katastar_region };
    }
    
    if (job && job.region && job.parcel) {
      jobs.push(job);
    }
  }
  return jobs;
}

function b64ToBlob(b64Data: string, contentType = "", sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length).fill(0).map((_, i) => slice.charCodeAt(i));
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray.buffer);
  }

  return new Blob(byteArrays, { type: contentType });
}

// --- END: Helper Functions ---


export default function Page() {
  // --- UI/Flow States ---
  const [inputMode, setInputMode] = useState<'manual' | 'file'>('manual'); // NEW: Tracks active tab
  const [isLoading, setLoading] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); 

  // --- Data States ---
  const [jobs, setJobs] = useState<JobInput[]>([ // Manual Input Jobs
    { region: "", katastar_region: "", parcel: "" },
  ]);
  const [uploadedJobs, setUploadedJobs] = useState<JobInput[]>([]); // File Input Jobs
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("results.xlsx");

  // --- Timer States ---
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null); 

  // ----------------------
  // TIMER FUNCTIONS
  // ----------------------

  const startTimer = () => {
    setIsFinished(false);
    setElapsedTime(0);
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    const startTime = Date.now();
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


  // ----------------------
  // MANUAL INPUT HANDLERS
  // ----------------------

  const addJob = () =>
    setJobs((prev) => [...prev, { region: "", katastar_region: "", parcel: "" }]);

  const removeJob = (idx: number) =>
    setJobs((prev) => prev.filter((_, i) => i !== idx));

  const updateJob = (idx: number, field: keyof JobInput, v: string) =>
    setJobs((prev) =>
      prev.map((j, i) => (i === idx ? { ...j, [field]: v } : j))
    );

  // ----------------------
  // FILE INPUT HANDLERS
  // ----------------------

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedJobs([]); 
    setIsStopped(false);
    setDownloadUrl(null); 
    setFilename("uploaded_results.xlsx");

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsedJobs = parseInputText(text);
      setUploadedJobs(parsedJobs);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      alert("Грешка при читањето на фајлот.");
    };

    reader.readAsText(file, "UTF-8");
  };

  // ----------------------
  // TAB/STOP/SUBMIT HANDLERS
  // ----------------------

  const handleTabSwitch = (mode: 'manual' | 'file') => {
    if (isLoading) return; // Prevent switching while running
    if (inputMode === mode) return; 

    setInputMode(mode);
    setDownloadUrl(null);
    setIsStopped(false);
    
    // Critical: Clear the state of the tab we are leaving
    if (mode === 'manual') {
      setUploadedJobs([]); // Clear file data when switching to manual
    } else {
      // Clear manual rows except for one initial row when switching to file
      setJobs([{ region: "", katastar_region: "", parcel: "" }]); 
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort(); 
        abortControllerRef.current = null;
    }
    setLoading(false);
    stopTimer();
    setIsStopped(true); 
    setDownloadUrl(null); 
  };
  

  const handleSubmit = async () => {
    setIsStopped(false);
    setDownloadUrl(null);
    
    let jobsToSubmit: JobInput[] = [];

    if (inputMode === 'file') {
      // Priority 1: Use the uploaded file data
      jobsToSubmit = uploadedJobs;
    } else {
      // Priority 2: Use the manually entered rows
      jobsToSubmit = jobs
        .map(({ region, katastar_region, parcel }) => ({
          region: region.trim(),
          parcel: parcel.trim(),
          katastar_region: katastar_region?.trim() || undefined,
        }))
        .filter((j) => j.region && j.parcel);
    }

    if (jobsToSubmit.length === 0) {
      alert("Ве молиме внесете најмалку еден ред или вчитајте датотека.");
      return;
    }
    
    setLoading(true);
    startTimer(); 

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const res = await postScrape({ jobs: jobsToSubmit }, controller.signal);
      
      abortControllerRef.current = null; 

      setFilename(res.filename || "results.xlsx");

      const blob = b64ToBlob(res.file_b64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const fileUrl = URL.createObjectURL(blob);
      setDownloadUrl(fileUrl);

    } catch (err: any) {
      console.error(err);
      
      if (axios.isCancel(err) || err.name === 'AbortError') {
         // Canceled by user (handleStop)
         return; 
      }
      
      alert(err?.response?.data?.detail || "Пребарувањето не успеа.");
      setIsStopped(false); 

    } finally {
      setLoading(false);
      stopTimer();
      abortControllerRef.current = null;
    }
  };

  const getJobCount = () => inputMode === 'file' ? uploadedJobs.length : jobs.length;


  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-black">Пребарување на парцели</h1>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <p className="text-black">
          Изберете начин на внес (рачен или преку датотека) за да ги започнете барањата.
        </p>

        {/* --- TAB BAR --- */}
        <div className="flex border-b border-zinc-200">
          <button
            className={`px-4 py-2 font-medium transition ${
              inputMode === 'manual'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => handleTabSwitch('manual')}
            disabled={isLoading}
          >
            Рачен Внес
          </button>
          <button
            className={`px-4 py-2 font-medium transition ${
              inputMode === 'file'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => handleTabSwitch('file')}
            disabled={isLoading}
          >
            Внес преку Датотека
          </button>
        </div>

        {/* --- INPUT AREA --- */}
        {inputMode === 'manual' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Внесете регион, опционален катастарски оддел, и број на парцела за секој ред.</p>
            {jobs.map((j, i) => (
              <JobRow
                key={i}
                idx={i}
                value={j}
                onChange={updateJob}
                onRemove={removeJob}
                isDeleteDisabled={jobs.length <= 1}
              />
            ))}
          </div>
        )}

        {inputMode === 'file' && (
          <div className="space-y-4 p-4 border border-zinc-200 rounded-xl bg-white shadow-sm">
            <p className="font-medium text-black">
                Формат на датотека: <code className="bg-zinc-100 p-1 rounded">Регион, [Катастарски оддел], Парцела</code> (користете запирка како сепаратор).
            </p>

            <button
              type="button"
              className={`rounded-2xl border ${
                uploadedJobs.length > 0
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                  : "border-zinc-300 hover:bg-zinc-100 text-black"
              } px-5 py-2 transition font-medium`}
              onClick={() => {
                if (isLoading) return;
                fileInputRef.current?.click();
              }}
              disabled={isLoading}
            >
              {uploadedJobs.length > 0 ? "🔄 Замени ја листата" : "⬆️ Вчитај листа (.txt)"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt"
              style={{ display: "none" }}
            />
            
            {uploadedJobs.length > 0 && (
              <div className="text-sm text-zinc-700 p-2 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center">
                <span>Успешно вчитани: **{uploadedJobs.length}** ред/редици. Подготвени за пребарување.</span>
                <button 
                    onClick={handleTabSwitch.bind(null, 'manual')}
                    className="text-red-600 hover:text-red-800 text-xs font-semibold underline"
                >
                    Откажи
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* --- ACTION BUTTONS --- */}
        <div className="flex items-center gap-3 pt-4">

          {isLoading ? (
            // 🛑 STOP Button
            <button
              type="button"
              className="rounded-2xl bg-red-600 text-white px-5 py-2 hover:bg-red-700 transition"
              onClick={handleStop}
            >
              СТОП
            </button>
          ) : (
            // ▶️ SUBMIT Button
            <button
              type="button"
              className="rounded-2xl bg-indigo-600 text-white px-5 py-2 hover:bg-indigo-700 transition"
              onClick={handleSubmit}
            >
              Пребарај ({getJobCount()} ред/редици)
            </button>
          )}

          {inputMode === 'manual' && !isLoading && (
            <button
              type="button"
              className="rounded-2xl border border-zinc-300 px-5 py-2 hover:bg-zinc-100 transition text-black"
              onClick={addJob}
            >
              + Додади редица
            </button>
          )}

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
