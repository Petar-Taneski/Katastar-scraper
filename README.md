#Katastar Scraper
Overview
The Katastar Scraper is a two‑part service that automates retrieval of cadastral data from the e‑uslugi.katastar.gov.mk portal. It handles the dynamic Material‑UI search workflow, extracts parcel details and right‑holder information and then aggregates the results into a single Excel file. A small FastAPI wrapper exposes the scraper as an HTTP API, and a Next.js front‑end provides a simple way to queue up many searches and download results.
The project is organised as a monorepo with two top‑level folders:
	•	katastar‑scraper/ – the Python backend containing the Selenium scraper and a FastAPI server (api/main.py). This is where the headless Chrome automation and Excel generation take place.
	•	katastar‑ui/ – the Next.js 14 front‑end built with TypeScript and Tailwind. It lets you enter an arbitrary number of region/parcel pairs (with an optional katastar region filter), displays progress while the backend scrapes, and provides a download link for the Excel report.
Features
	•	Automated navigation and scraping – Uses Selenium WebDriver to interact with the Material‑UI components on the Katastar portal (region dropdown, parcel field etc.).
	•	Flexible input – Supports three modes of input:
	•	Single job via CLI arguments: python scrape_katastar.py <region> <parcel> with optional --katastar <katastar> to restrict to one suggestion.
	•	Batch via input file: --input‑file input_pairs.txt where each line contains either region, parcel or region, katastar, parcel (comma/semicolon/tab separated).
	•	Via API/UI: send a JSON payload to the FastAPI /scrape endpoint or use the Next.js interface to queue multiple jobs.
	•	Optional katastar region filter – When a katastar region (e.g. “Скопје”) is provided it will only scrape the dropdown suggestion that contains that text; otherwise it iterates through all suggestions returned for the base region.
	•	Excel output – Results are written to a single worksheet in results.xlsx with hierarchical indentation: region suggestion rows are bold and shaded; parcel rows are indented once; right‑holder rows are indented twice. Columns also include the original input region/katastar/parcel and a note column for messages such as “no parcels found”.
	•	HTTP API – A FastAPI wrapper accepts a JSON list of jobs and returns a base64‑encoded Excel workbook. The API is CORS‑enabled for ease of integration with the UI.
	•	Modern front‑end – The Next.js UI (React + Tailwind) allows users to add and remove rows dynamically, specify an optional katastar region, display real‑time progress and download the resulting Excel file. The design is minimalist with rounded edges, subtle hover transitions and responsive layouts.
Prerequisites
	•	Python 3.8+ – The backend uses modern Python. Verify with python3 --version.
	•	Node 18+ – Required for the Next.js front‑end. Verify with node --version.
	•	Google Chrome – The scraper runs Chrome in headless mode. ChromeDriver is managed automatically by the webdriver‑manager package, so you don’t need to download it yourself.
	•	virtualenv (recommended) – Isolate Python dependencies. Install with python3 -m pip install virtualenv if not already available.
Getting Started
Backend (Python)
	•	Clone the repo and set up a virtual environment:
git clone https://github.com/your‑username/katastar-scraper.git cd katastar-scraper python3 -m venv venv source venv/bin/activate
	•	Install the Python dependencies:
pip install selenium webdriver‑manager openpyxl fastapi uvicorn[standard]
	•	Run the scraper via CLI (single job):
python scrape_katastar.py "Нерези" "944/2" --katastar "Скопје"
To process a list of jobs, create input_pairs.txt with one job per line:
Нерези,944/2 Нерези,Скопје,944/2 Нерези,Гостивар,944/2
Then run:
python scrape_katastar.py --input‑file input_pairs.txt
After completion you will find results.xlsx (and optionally results.txt) in the project folder.
	•	Run the API: To expose the scraper via HTTP, start the FastAPI service:
cd api uvicorn api.main:app --reload --port 8000
You can now POST to http://localhost:8000/scrape with a JSON body like:
{   "jobs": [     { "region": "Нерези", "parcel": "944/2" },     { "region": "Нерези", "katastar_region": "Скопје", "parcel": "944/2" }   ] }
The response contains filename and file_b64; decode the base64 to an .xlsx file.
Front‑end (Next.js)
	•	Navigate to the UI folder:
cd ../katastar-ui
	•	Install Node dependencies:
npm install
	•	Configure API base – Create .env.local with:
NEXT_PUBLIC_API_BASE=http://localhost:8000
	•	Run the development server:
npm run dev
Open http://localhost:3000 in your browser. You can add as many rows as you like, specify optional katastar regions and parcels, and click Submit. A progress panel shows the current job being scraped. When finished a download button appears for the results.
Deployment Notes
Running headless Chrome is not supported in Vercel’s serverless environment. In production you should host the FastAPI backend on a VM or container (e.g. Hetzner, DigitalOcean, EC2). Ensure Chrome/Chromedriver is installed on that host and expose port 80/443 through a reverse proxy (Nginx or Caddy). Then set NEXT_PUBLIC_API_BASE=https://your-api-domain in your Vercel project’s environment variables.
Input File Format
The scraper accepts two formats:
	•	Region, Parcel – When only two fields are provided the scraper will iterate through every autocomplete suggestion returned for that region.
	•	Region, KatastarRegion, Parcel – When three fields are provided the scraper looks for a suggestion that contains the second field (case‑insensitive substring). If found it scrapes only that suggestion; otherwise it records a “not found” note.
Fields can be separated by commas, semicolons or tabs. Lines beginning with # are ignored as comments.
Output Format
Results are written to an Excel workbook (results.xlsx). The workbook contains a single sheet called results where each job’s data is grouped in a hierarchical layout:
	•	Input Region / Input KatastarRegion / Input Parcel – The first three columns repeat the original input for traceability.
	•	Kat. Odd. (Region Suggestion) – The suggestion from the dropdown (e.g. “Нерези – кат. одд. Скопје”). Rows for this column are bold and shaded.
	•	Parcel columns – For each parcel row: “Имотен лист”, “Број/дел”, “Култура”, “Површина m²”, “Место”, “Право”. These rows are indented by one level.
	•	Right‑holder columns – For each holder row: “Име и презиме”, “Град”, “Улица”, “Број”, “Дел на посед”. These rows are indented twice.
	•	Note – Extra messages, such as “Katastar region ‘Гостивар’ not found in suggestions.” or “No parcel suggestions found for ‘9/1’ in region ...”.
Excel columns automatically resize and text wraps so that long names and notes are fully visible.
Development Guidelines
Python
Keep the scraping logic in scrape_katastar.py lean and modular; avoid hard‑coded waits by using WebDriverWait and explicit conditions. When updating the site selectors test against the live portal because Material‑UI classes can change.
FastAPI
The API server in api/main.py uses Pydantic models to validate input and respond with JSON. CORS is enabled for all origins in development; restrict it in production. Consider adding logging or rate limiting if you expose the API publicly.
Next.js
The front‑end uses React hooks and TypeScript. It relies on environment variable NEXT_PUBLIC_API_BASE to know where to send requests. Use Tailwind utility classes for styling and keep components small and reusable. The extracted helper b64ToBlob() converts the base64 payload to a Blob so that it can be downloaded as a file.
Contributing
Pull requests and bug reports are welcome! Please open an issue with a clear description of the problem and steps to reproduce.
License
This project is released under the MIT License. See LICENSE for details.

