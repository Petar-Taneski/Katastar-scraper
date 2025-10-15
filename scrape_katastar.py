#!/usr/bin/env python3
import sys
import argparse
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager

def get_region_suggestions(driver, wait, region_text):
    region_input = wait.until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "input[placeholder='Внеси катастарска општина']")))
    region_input.clear()
    region_input.send_keys(region_text)
    try:
        wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "li[role='option']")))
    except TimeoutException:
        return []
    return driver.find_elements(By.CSS_SELECTOR, "li[role='option']")

def select_parcel(driver, wait, parcel_text):
    parcel_input = wait.until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "input[placeholder='Внеси парцела']")))
    parcel_input.clear()
    parcel_input.send_keys(parcel_text)
    try:
        wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "li[role='option']")))
    except TimeoutException:
        return False
    suggestions = driver.find_elements(By.CSS_SELECTOR, "li[role='option']")
    chosen = None
    for s in suggestions:
        if parcel_text in s.text:
            chosen = s
            break
    if chosen is None:
        chosen = suggestions[0]
    chosen.click()
    return True

def extract_parcel_and_holders(driver, wait):
    wait.until(EC.presence_of_all_elements_located(
        (By.CSS_SELECTOR, "tr.parcels-table-body-row")))
    rows_count = len(driver.find_elements(By.CSS_SELECTOR, "tr.parcels-table-body-row"))
    result = []
    for i in range(rows_count):
        parcel_rows = driver.find_elements(By.CSS_SELECTOR, "tr.parcels-table-body-row")
        row = parcel_rows[i]
        cells = row.find_elements(By.TAG_NAME, "td")
        data = {
            "Имотен лист": cells[1].text,
            "Број/дел": cells[2].text,
            "Култура": cells[3].text,
            "Површина m2": cells[4].text,
            "Место": cells[5].text,
            "Право": cells[6].text,
        }
        original_handle = driver.current_window_handle
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", cells[1])
        driver.execute_script("arguments[0].click();", cells[1])
        wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "#right-holders-table-paper")))
        if len(driver.window_handles) > 1:
            for handle in driver.window_handles:
                if handle != original_handle:
                    driver.switch_to.window(handle)
                    break
        holder_rows = wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "#right-holders-table-paper tbody tr")))
        holders = []
        for hrow in holder_rows:
            hc = hrow.find_elements(By.TAG_NAME, "td")
            holders.append({
                "Имотен лист": hc[0].text,
                "Име и презиме": hc[1].text,
                "Град": hc[2].text,
                "Улица": hc[3].text,
                "Број": hc[4].text,
                "Дел на посед": hc[5].text,
            })
        data["Носители на право"] = holders
        if len(driver.window_handles) > 1:
            driver.close()
            driver.switch_to.window(original_handle)
        else:
            driver.back()
        result.append(data)
        wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "tr.parcels-table-body-row")))
    return result

def scrape_katastar(region, parcel):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--window-size=1920,1080")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    wait = WebDriverWait(driver, 20)
    region_results = []
    try:
        driver.get("https://e-uslugi.katastar.gov.mk/")
        suggestions = get_region_suggestions(driver, wait, region)
        if not suggestions:
            print(f"No region suggestions found for '{region}'")
            return region_results
        for idx in range(len(suggestions)):
            suggestions = get_region_suggestions(driver, wait, region)
            current = suggestions[idx]
            region_name = current.text
            current.click()
            region_entry = {"region_name": region_name, "parcels": []}
            if select_parcel(driver, wait, parcel):
                region_entry["parcels"] = extract_parcel_and_holders(driver, wait)
            else:
                print(f"No parcel suggestions found for '{parcel}' in region '{region_name}'.")
            region_results.append(region_entry)
            driver.get("https://e-uslugi.katastar.gov.mk/")
        return region_results
    finally:
        driver.quit()

def read_input_file(file_path):
    """
    Read region/parcel pairs from a text file.
    Lines beginning with # are ignored.
    Accepts comma, semicolon or tab as separators.
    Returns a list of (region, parcel) tuples.
    """
    pairs = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in re.split(r"[,\t;]", line) if p.strip()]
            if len(parts) >= 2:
                pairs.append((parts[0], parts[1]))
    return pairs

def write_results_to_file(region_results, filename="results.txt"):
    with open(filename, "w", encoding="utf-8") as f:
        for reg in region_results:
            region_name = reg["region_name"]
            parcels = reg["parcels"]
            input_region = reg.get("input_region")
            input_parcel = reg.get("input_parcel")
            if input_region is not None and input_parcel is not None:
                f.write(f"Input: Region='{input_region}', Parcel='{input_parcel}'\n")
            f.write(f"Катастарска општина: {region_name}\n")
            f.write(f"Парцели пронајдени: {len(parcels)}\n")
            if not parcels:
                f.write("  - Нема парцели пронајдени за овој избор.\n\n")
                continue
            for parcel in parcels:
                f.write("---------\n")
                for key, value in parcel.items():
                    if key != "Носители на право":
                        f.write(f"{key}: {value}\n")
                f.write("Носители на право:\n")
                for holder in parcel["Носители на право"]:
                    holder_line = ", ".join(f"{k}: {v}" for k, v in holder.items())
                    f.write(f"  - {holder_line}\n")
                f.write("\n")
            f.write("\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape parcel and right-holder data from e-uslugi.katastar.gov.mk")
    parser.add_argument("--input-file", "-i", help="Path to a file containing region,parcel pairs")
    parser.add_argument("region", nargs="?", help="Region to search (used if no input file)")
    parser.add_argument("parcel", nargs="?", help="Parcel to search (used if no input file)")
    args = parser.parse_args()

    pairs_to_process = []
    if args.input_file:
        pairs_to_process = read_input_file(args.input_file)
        if not pairs_to_process:
            print(f"No valid entries found in input file {args.input_file}")
            sys.exit(1)
    else:
        if not args.region or not args.parcel:
            parser.error("Either --input-file or both region and parcel arguments are required.")
        pairs_to_process = [(args.region, args.parcel)]

    all_results = []
    for region, parcel in pairs_to_process:
        region_results = scrape_katastar(region, parcel)
        for entry in region_results:
            # Attach the original input region/parcel for traceability
            entry["input_region"] = region
            entry["input_parcel"] = parcel
        all_results.extend(region_results)

    if all_results:
        write_results_to_file(all_results, "results.txt")
        print(f"Results written to results.txt for {len(all_results)} region suggestion(s) across {len(pairs_to_process)} input pair(s).")
    else:
        print("No results found.")
