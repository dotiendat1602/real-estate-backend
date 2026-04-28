declare module "wellknown" {
  const wellknown: {
    parse: (wkt: string) => any;
    stringify?: (geojson: any) => string;
  };

  export default wellknown;
}
