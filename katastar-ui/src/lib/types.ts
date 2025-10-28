export type JobInput = {
  region: string;
  parcel: string;
  katastar_region?: string;
};

export type ScrapeRequest = {
  jobs: JobInput[];
};

export type ScrapeResponse = {
  filename: string;
  file_b64: string; // base64 excel file
};
