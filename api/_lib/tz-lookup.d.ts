declare module 'tz-lookup' {
  // IANA time zone name for a coordinate, e.g. "Asia/Kolkata". Throws for invalid coordinates.
  function tzlookup(lat: number, lon: number): string;
  export = tzlookup;
}
