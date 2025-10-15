# Katastar-scraper

Katastar Scraper Service

This repository contains a simple scraping service for the e‑uslugi.katastar.gov.mk portal. The tool automates the process of searching for cadastral parcels, extracting parcel details and right‑holder information, and saving the output to a text file.

Features

Automates interaction with the dynamic search interface on e‑uslugi.katastar.gov.mk using Selenium.

Supports searching by a single pair of region and parcel from the command line or by a list of pairs supplied in an input file.

Handles multiple autocomplete suggestions for a region and processes each one, even when some suggestions return no parcels.

Extracts parcel details and right‑holder tables and groups the results by the selected region suggestion.

Writes a neatly formatted report to a results.txt file in the project folder.

Prerequisites

Python 3.8+: Make sure Python is installed on your system. You can verify this with python3 --version.

Google Chrome: The scraper uses Chrome in headless mode.

ChromeDriver: Managed automatically by the webdriver‑manager package, so you do not need to download ChromeDriver manually.

virtualenv (recommended): To isolate dependencies for this project.

Installation

Clone the repository (or download the files) and open a terminal in the project directory:
