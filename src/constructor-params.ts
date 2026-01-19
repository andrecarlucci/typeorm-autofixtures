/* eslint-disable @typescript-eslint/ban-types */
// Extracts keys of required properties (properties without '?')
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
// Type that includes only the initial non-optional properties of T
type RequiredProps<T> = Pick<T, RequiredKeys<T>>;
// Combine required with Partial
export type ConstructorParams<T> = RequiredProps<T> & Partial<T>;
